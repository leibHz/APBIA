document.addEventListener('DOMContentLoaded', () => {
    // ======================================================
    // SELETORES E VARIÁVEIS GLOBAIS
    // ======================================================
    // Telas
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Abas de Autenticação
    const loginTabButton = document.getElementById('login-tab');
    const registerTabButton = document.getElementById('register-tab');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');

    // Formulários
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const chatForm = document.getElementById('chat-form');

    // Elementos de Mensagem
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    const chatMessagesContainer = document.getElementById('chat-messages');

    // Inputs
    const messageInput = document.getElementById('message-input');

    // Botões
    const logoutButton = document.getElementById('logout-button');
    
    // Perfil do Usuário na UI
    const userProfileName = document.getElementById('user-profile-name');
    const userProfileBp = document.getElementById('user-profile-bp');

    // Estado da Aplicação
    let currentUser = null;
    let currentSession = null;

    // ======================================================
    // INICIALIZAÇÃO DO SUPABASE
    // ======================================================
    const supabaseUrl = 'https://xacdvajnkqlykjciqjpu.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhY2R2YWpua3FseWtqY2lxanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjMyMDYsImV4cCI6MjA3MjU5OTIwNn0.hFgcInHemTFVfTwfrib8zCetkZVLi6W4kuNHQhYnPE8';
    
    const sb = supabase.createClient(supabaseUrl, supabaseAnonKey);

    // ======================================================
    // FUNÇÕES AUXILIARES
    // ======================================================

    /**
     * Mostra uma mensagem de erro ou sucesso nos formulários de autenticação.
     * @param {HTMLElement} element - O elemento HTML para exibir a mensagem.
     * @param {string} message - O texto da mensagem.
     * @param {boolean} isError - Se a mensagem é de erro (true) ou sucesso (false).
     */
    function showAuthMessage(element, message, isError = true) {
        if (element) {
            element.textContent = message;
            element.className = isError 
                ? 'text-red-400 text-sm mt-2 text-center' 
                : 'text-green-400 text-sm mt-2 text-center';
            element.classList.remove('hidden');
        }
    }

    /**
     * Limpa as mensagens de autenticação.
     */
    function clearAuthMessages() {
        if (loginMessage) loginMessage.classList.add('hidden');
        if (registerMessage) registerMessage.classList.add('hidden');
    }

    /**
     * Alterna a visibilidade entre a tela de autenticação e a de chat.
     * @param {boolean} showChat - Se deve mostrar a tela de chat (true) ou a de autenticação (false).
     */
    function toggleScreen(showChat) {
        if (showChat) {
            authContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
        } else {
            authContainer.classList.remove('hidden');
            chatContainer.classList.add('hidden');
        }
        loadingOverlay.classList.add('hidden');
    }
    
    /**
     * Adiciona uma mensagem à interface do chat.
     * @param {string} sender - 'user' ou 'ai'.
     * @param {string} text - O conteúdo da mensagem.
     */
    function addMessageToUI(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('p-4', 'rounded-lg', 'max-w-xl', 'mb-4', 'whitespace-pre-wrap');

        if (sender === 'user') {
            messageElement.classList.add('bg-blue-600', 'text-white', 'self-end', 'ml-auto');
        } else {
            messageElement.classList.add('bg-gray-700', 'text-gray-200', 'self-start', 'mr-auto');
            // Adiciona o ícone da IA
            messageElement.innerHTML = `<div class="flex items-start space-x-3">
                <i class="fas fa-robot text-blue-400 mt-1"></i>
                <p>${text.trim()}</p>
            </div>`;
        }
        
        if (sender === 'user') {
            messageElement.textContent = text.trim();
        }

        chatMessagesContainer.appendChild(messageElement);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    /**
     * Busca o perfil do usuário logado e atualiza a interface.
     */
    async function updateUserProfileUI() {
        if (!currentUser) return;
        const { data: profile, error } = await sb
            .from('profiles')
            .select('full_name, bp')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            userProfileName.textContent = profile.full_name || 'Usuário';
            userProfileBp.textContent = profile.bp || 'BP não encontrado';
        }
    }

    // ======================================================
    // LÓGICA DE AUTENTICAÇÃO
    // ======================================================
    
    // Troca de abas entre Login e Cadastro
    if (loginTabButton && registerTabButton) {
        loginTabButton.addEventListener('click', () => {
            loginTabButton.classList.add('border-blue-500');
            registerTabButton.classList.remove('border-blue-500');
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
            clearAuthMessages();
        });

        registerTabButton.addEventListener('click', () => {
            registerTabButton.classList.add('border-blue-500');
            loginTabButton.classList.remove('border-blue-500');
            registerFormContainer.classList.remove('hidden');
            loginFormContainer.classList.add('hidden');
            clearAuthMessages();
        });
    }

    // Processamento do formulário de CADASTRO
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthMessages();
            const fullName = e.target.fullName.value;
            const bp = e.target.bp.value.toUpperCase();
            const email = e.target.email.value;
            const password = e.target.password.value;

            if (password.length < 6) {
                showAuthMessage(registerMessage, 'A senha deve ter pelo menos 6 caracteres.');
                return;
            }

            try {
                // ---> INÍCIO DA CORREÇÃO <---
                // Verifica na tabela 'allowed_users' em vez de 'allowed_participants'
                const { data: allowedUser, error: checkError } = await sb
                    .from('allowed_users')
                    .select('bp')
                    .eq('bp', bp)
                    .single();
                // ---> FIM DA CORREÇÃO <---

                if (checkError || !allowedUser) {
                    showAuthMessage(registerMessage, 'Seu prontuário (BP) não tem permissão para se cadastrar.');
                    return;
                }
                
                showAuthMessage(registerMessage, 'Criando conta...', false);
                const { data, error } = await sb.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullName,
                            bp: bp,
                        }
                    }
                });

                if (error) throw error;

                showAuthMessage(registerMessage, 'Cadastro realizado com sucesso! Faça o login.', false);
                registerForm.reset();

            } catch (error) {
                console.error('Erro no cadastro:', error);
                showAuthMessage(registerMessage, error.message || 'Ocorreu um erro ao tentar se cadastrar.');
            }
        });
    }

    // Processamento do formulário de LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthMessages();
            loadingOverlay.classList.remove('hidden');

            const bp = e.target.bp.value.toUpperCase();
            const password = e.target.password.value;

            try {
                const { data: profile, error: profileError } = await sb
                    .from('profiles')
                    .select('email')
                    .eq('bp', bp)
                    .single();

                if (profileError || !profile) {
                    throw new Error('BP não encontrado ou inválido.');
                }
                
                const { data, error } = await sb.auth.signInWithPassword({
                    email: profile.email,
                    password: password
                });

                if (error) throw error;
                
                currentUser = data.user;
                currentSession = data.session;
                await updateUserProfileUI();
                toggleScreen(true);

            } catch (error) {
                console.error('Erro no login:', error);
                showAuthMessage(loginMessage, error.message || 'Ocorreu um erro ao tentar fazer login.');
                loadingOverlay.classList.add('hidden');
            }
        });
    }
    
    // Processamento de LOGOUT
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await sb.auth.signOut();
            currentUser = null;
            currentSession = null;
            toggleScreen(false);
        });
    }

    // ======================================================
    // LÓGICA DO CHAT
    // ======================================================
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = messageInput.value.trim();
            if (!userInput) return;

            addMessageToUI('user', userInput);
            messageInput.value = '';
            messageInput.style.height = 'auto';

            // Adiciona um placeholder de "pensando..."
            addMessageToUI('ai', 'Pensando...');

            try {
                const { data, error } = await sb.functions.invoke('ask-apbia', {
                    body: { query: userInput },
                });

                if (error) throw error;

                // Remove o placeholder "Pensando..."
                const thinkingMessage = chatMessagesContainer.lastChild;
                if (thinkingMessage && thinkingMessage.textContent.includes('Pensando...')) {
                    chatMessagesContainer.removeChild(thinkingMessage);
                }
                
                addMessageToUI('ai', data.reply);

            } catch (error) {
                console.error('Erro ao chamar a Edge Function:', error);
                // Remove o placeholder "Pensando..."
                const thinkingMessage = chatMessagesContainer.lastChild;
                if (thinkingMessage && thinkingMessage.textContent.includes('Pensando...')) {
                    chatMessagesContainer.removeChild(thinkingMessage);
                }
                addMessageToUI('ai', `Desculpe, ocorreu um erro: ${error.message}`);
            }
        });
    }
    
    // Ajuste dinâmico da altura do textarea
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
        });
    }

    // ======================================================
    // INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================
    async function initializeApp() {
        const { data } = await sb.auth.getSession();
        currentSession = data.session;
        currentUser = data.session?.user ?? null;

        if (currentUser) {
            await updateUserProfileUI();
            toggleScreen(true);
        } else {
            toggleScreen(false);
        }
    }

    initializeApp();
});

