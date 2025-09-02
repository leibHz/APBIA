import os
import time
import json
import csv
import google.generativeai as genai
import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

# --- 1. CONFIGURAÇÃO INICIAL ---
# Cole sua Chave de API do Google AI Studio aqui.
# É recomendado usar variáveis de ambiente ou um gerenciador de segredos em produção.
GOOGLE_API_KEY = "AIzaSyBhxdu9iXVPLZpQhen32l74nP2L_gm9evI"

# Modelo de embedding a ser usado (ATUALIZADO conforme documentação de 2024).
EMBEDDING_MODEL = "text-embedding-004"
# Limite de tokens do modelo.
TOKEN_LIMIT = 2048
# Margem de segurança para o aviso de limite de tokens (em porcentagem).
TOKEN_WARNING_THRESHOLD = 0.90  # 90%

# Configurações do processo
SOURCE_DATA_FOLDER = "dadosTXT"
OUTPUT_FILE = "embeddings.csv"
PROGRESS_FILE = "progress.json"

# Configurações de Chunking (Divisão do Texto)
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 150

# Configurações de Controle (ATUALIZADO PARA BATCHING)
# Número de chunks a serem enviados em uma única chamada de API.
# A documentação permite até 100.
BATCH_SIZE = 50
# Delay em segundos entre cada LOTE de chamadas à API para controlar o ritmo.
DELAY_BETWEEN_BATCHES = 5

# --- 2. FUNÇÕES AUXILIARES ---

def configure_google_api():
    """Configura a API do Google Generative AI com a chave fornecida."""
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        print("✅ API do Google configurada com sucesso.")
    except Exception as e:
        print(f"❌ Erro ao configurar a API do Google: {e}")
        print("   Por favor, verifique se a sua GOOGLE_API_KEY está correta.")
        exit()

def count_tokens(text):
    """Estima o número de tokens em um texto usando tiktoken."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

def load_progress():
    """Carrega o progresso de um arquivo JSON. Se não existir, começa do zero."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            print(f"🔄 Progresso encontrado em '{PROGRESS_FILE}'. Retomando processo...")
            return json.load(f)
    return {
        "last_processed_file": None,
        "last_processed_chunk_index": -1
    }

# --- CORREÇÃO: A função agora aceita e salva apenas o 'filename' ---
def save_progress(filename, chunk_index):
    """Salva o estado atual do processamento no arquivo de progresso."""
    progress_data = {
        "last_processed_file": filename,
        "last_processed_chunk_index": chunk_index
    }
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress_data, f, indent=4)

# --- 3. LÓGICA PRINCIPAL ---

def main():
    """Função principal que orquestra o processo de geração de embeddings."""
    if GOOGLE_API_KEY == "SUA_CHAVE_API_AQUI":
        print("❌ ATENÇÃO: Por favor, insira sua GOOGLE_API_KEY na variável no topo do script.")
        return

    configure_google_api()

    if not os.path.exists(SOURCE_DATA_FOLDER):
        os.makedirs(SOURCE_DATA_FOLDER)
        print(f"📂 Pasta '{SOURCE_DATA_FOLDER}' criada. Por favor, adicione seus arquivos .txt nela e rode o script novamente.")
        return

    progress = load_progress()
    files_to_process = sorted([f for f in os.listdir(SOURCE_DATA_FOLDER) if f.endswith('.txt')])

    if not files_to_process:
        print(f"❌ Nenhum arquivo .txt encontrado na pasta '{SOURCE_DATA_FOLDER}'.")
        return

    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f_out:
            writer = csv.writer(f_out)
            writer.writerow(['id', 'source', 'content', 'embedding'])
        print(f"📄 Arquivo CSV '{OUTPUT_FILE}' criado com cabeçalho.")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
    )

    try:
        for filename in files_to_process:
            # --- CORREÇÃO: A comparação agora é entre nomes de arquivo, funcionando corretamente ---
            if progress["last_processed_file"] and filename < progress["last_processed_file"]:
                print(f"⏭️  Pulando arquivo já processado (lógica antiga): {filename}")
                continue

            file_path = os.path.join(SOURCE_DATA_FOLDER, filename)
            
            # Pula arquivos que já foram 100% concluídos
            if progress["last_processed_file"] == filename and progress["last_processed_chunk_index"] == -999:
                 print(f"⏭️  Pulando arquivo já finalizado: {filename}")
                 continue

            print(f"\n📄 Processando arquivo: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()

            all_chunks = text_splitter.split_text(text)
            print(f"   Dividido em {len(all_chunks)} chunks.")

            start_index = 0
            # --- CORREÇÃO: A comparação para retomada agora usa 'filename' ---
            if progress["last_processed_file"] == filename:
                start_index = progress["last_processed_chunk_index"] + 1
                if start_index > 0 and start_index < len(all_chunks):
                    print(f"   Retomando a partir do chunk {start_index + 1}")
            
            if start_index >= len(all_chunks) and len(all_chunks) > 0:
                print(f"   Arquivo {filename} já parece estar completamente processado. Pulando.")
                continue


            chunks_to_process = all_chunks[start_index:]
            
            for i in range(0, len(chunks_to_process), BATCH_SIZE):
                batch_texts = chunks_to_process[i:i + BATCH_SIZE]
                current_batch_indices = range(start_index + i, start_index + i + len(batch_texts))

                print(f"\n--- Processando Lote (Batch) de {len(batch_texts)} chunks (iniciando no chunk {current_batch_indices[0] + 1}) ---")

                valid_batch_texts = []
                valid_indices = []
                for text, original_index in zip(batch_texts, current_batch_indices):
                    token_count = count_tokens(text)
                    if token_count >= TOKEN_LIMIT:
                        print(f"   🚨 AVISO GRAVE: O chunk {original_index + 1} tem {token_count} tokens e será pulado.")
                    else:
                        valid_batch_texts.append(text)
                        valid_indices.append(original_index)

                if not valid_batch_texts:
                    print("   Nenhum chunk válido neste lote para processar.")
                    if current_batch_indices:
                        save_progress(filename, current_batch_indices[-1])
                    continue

                print(f"   Gerando embeddings para {len(valid_batch_texts)} chunks...")
                try:
                    response = genai.embed_content(
                        model=EMBEDDING_MODEL,
                        content=valid_batch_texts,
                        task_type="RETRIEVAL_DOCUMENT"
                    )
                    batch_embeddings = response['embedding']
                except Exception as e:
                    print(f"   ❌ Erro ao gerar embeddings para o lote: {e}")
                    print("   O progresso foi salvo. O script será encerrado.")
                    if current_batch_indices[0] > 0:
                        save_progress(filename, current_batch_indices[0] - 1)
                    return

                with open(OUTPUT_FILE, 'a', newline='', encoding='utf-8') as f_out:
                    writer = csv.writer(f_out)
                    for text, original_index, vector in zip(valid_batch_texts, valid_indices, batch_embeddings):
                        embedding_str = json.dumps(vector)
                        csv_row = [
                            f"{filename}_chunk_{original_index + 1}",
                            filename,
                            text,
                            embedding_str
                        ]
                        writer.writerow(csv_row)
                
                print(f"   ✅ Lote salvo com sucesso em '{OUTPUT_FILE}'.")

                last_processed_index_in_batch = valid_indices[-1]
                # --- CORREÇÃO: Chamada da função agora passa 'filename' ---
                save_progress(filename, last_processed_index_in_batch)
                print(f"   💾 Progresso salvo. Último chunk processado: {last_processed_index_in_batch + 1}")

                if len(chunks_to_process) > BATCH_SIZE:
                    print(f"   Aguardando {DELAY_BETWEEN_BATCHES} segundos antes do próximo lote...")
                    time.sleep(DELAY_BETWEEN_BATCHES)

            # --- CORREÇÃO: Marca o arquivo como finalizado de forma explícita ---
            # Usamos -999 como um código para "processamento concluído"
            save_progress(filename, -999)
            print(f"   🎉 Arquivo {filename} processado completamente.")

    except KeyboardInterrupt:
        print("\n\nProcesso interrompido pelo usuário (Ctrl+C). O progresso foi salvo.")
    finally:
        print("\n✨ Processo finalizado! ✨")

if __name__ == "__main__":
    main()
