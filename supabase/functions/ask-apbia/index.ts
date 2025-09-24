import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
const SUPABASE_PROJECT_URL = 'https://xacdvajnkqlykjciqjpu.supabase.co';

// ---> INÍCIO DA MUDANÇA (OTIMIZAÇÃO) <---
// Trocamos os PDFs pesados pelos arquivos .txt, que são muito mais leves.
const CONTEXT_FILES = [
  "bragantec 2011.txt",
  "bragantec 2012.txt",
  "bragantec 2013.txt",
  "bragantec 2014.txt",
  "bragantec 2015.txt",
  "bragantec 2016.txt",
  "bragantec 2017.txt",
  "bragantec 2018.txt",
  "bragantec 2019.txt",
];
const BUCKET_NAME = "context-txts"; // Usamos o novo bucket.
const MIME_TYPE = "text/plain";     // O tipo de arquivo agora é texto simples.
// ---> FIM DA MUDANÇA <---

// Função auxiliar para converter ArrayBuffer em Base64
function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    const { query } = await req.json();
    if (!query) throw new Error('A "query" é obrigatória.');

    // 1. Faz o download do conteúdo dos arquivos .txt do Supabase Storage
    const filePromises = CONTEXT_FILES.map(async (fileName) => {
      const fileUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(fileName)}`;
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Falha ao baixar o arquivo: ${fileName}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      
      return {
        inline_data: {
          mime_type: MIME_TYPE,
          data: base64Data
        }
      };
    });

    const fileParts = await Promise.all(filePromises);

    // 2. Cria a parte da pergunta do usuário com um prompt detalhado
    const userQueryPart = { 
      text: `Você é o APBIA, um assistente amigável e especialista na feira de ciências Bragantec. Sua principal fonte de conhecimento são os resumos de anos anteriores que foram fornecidos. Baseie suas respostas principalmente nesses documentos, citando exemplos de projetos passados quando for relevante. Responda à seguinte pergunta de um estudante: ${query}` 
    };

    // 3. Monta o payload com os dados dos arquivos embutidos
    const payload = {
      contents: [{
        parts: [
          ...fileParts,
          userQueryPart
        ]
      }]
    };

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.json();
        console.error('Erro da API do Gemini:', errorBody);
        throw new Error(`A API do Gemini respondeu com o status: ${geminiResponse.status}`);
    }

    const result = await geminiResponse.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Não foi possível extrair a resposta da API do Gemini.");

    return new Response(JSON.stringify({ reply: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro interno na função:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

