const API_URL = 'https://147.182.191.150:4000/getlist';
const API_URL_FALLBACK = 'http://147.182.191.150:4000/getlist';
const API_URL_PROXY = '/api/getlist';
const API_URL_CORS_PROXY = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://147.182.191.150:4000/getlist');
const UPDATE_INTERVAL = 10000;

// Configuração de rotação automática
let rotationInterval = 30000; // 30 segundos por padrão
let rotationIntervalMinutes = 0.5; // 0.5 minutos

const EXCLUDED_BOTS = ['CoPilot', 'Depto. Comercial - Grupo Hi']; 

// Armazenará todos os dados do dia para não precisar buscar novamente
let fullTodayData = [];
let activeSectors = ['NRS', 'NRS Franqueados']; // Visão padrão
let isProduction = window.location.protocol === 'https:';

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Inicia o ciclo principal
    initializeDashboard();
    setInterval(fetchAndRefresh, UPDATE_INTERVAL);
    
    // Inicializa controles de scroll das abas
    initializeTabScrollControls();
    
    // Inicializa controles do modal
    initializeModalControls();
    
    // Inicializa controles de rotação automática
    initializeAutoRotationControls();
    
    // Detecta os setores disponíveis para rotação
    detectAvailableSectors();
});

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
}

// Roda apenas uma vez no início para criar as abas
async function initializeDashboard() {
    await fetchAndRefresh(); // Busca os dados e renderiza a visão padrão
    
    // Descobre todos os setores únicos dos dados
    const allSectors = [...new Set(fullTodayData.map(item => item['Canal Aberto']).filter(Boolean))];
    const tabsContainer = document.getElementById('sector-tabs');
    tabsContainer.innerHTML = ''; // Limpa abas antigas

    // Cria a aba padrão "NRS & Franqueados"
    const defaultTab = createTabButton(['NRS', 'NRS Franqueados'], 'NRS & Franqueados');
    tabsContainer.appendChild(defaultTab);

    // Cria uma aba para cada outro setor
    allSectors.forEach(sector => {
        if (sector !== 'NRS' && sector !== 'NRS Franqueados') {
            const tab = createTabButton([sector], sector);
            tabsContainer.appendChild(tab);
        }
    });

    updateActiveTab();
}

// Dados mockados para demonstração quando a API não estiver disponível
const getMockData = () => {
    const today = new Date();
    const mockData = [];
    
    // Gera dados mockados para diferentes setores
    const sectors = ['NRS', 'NRS Franqueados', 'Comercial', 'Suporte'];
    const agents = ['Ana Silva', 'Carlos Santos', 'Maria Oliveira', 'João Costa', 'Pedro Lima'];
    const statuses = ['Cliente aguardando resposta do agente', 'Nova conversa iniciada', 'Em atendimento'];
    
    for (let i = 0; i < 25; i++) {
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        const agent = Math.random() > 0.3 ? agents[Math.floor(Math.random() * agents.length)] : '—';
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        mockData.push({
            'Canal Aberto': sector,
            'Funcionário': agent,
            'Status (detalhado)': status,
            'Cliente': `Cliente ${i + 1}`,
            'Modificado em': today.toISOString(),
            'Criado em': new Date(today.getTime() - Math.random() * 3600000).toISOString()
        });
    }
    
    return mockData;
};

// Função para buscar novos dados e atualizar a tela
async function fetchAndRefresh() {
    try {
        const allData = await fetchData();
        fullTodayData = allData.filter(filterByToday).filter(filterOutBots);
        renderDashboardForSectors(activeSectors);
        hideConnectionError();
    } catch (error) {
        console.error("Falha ao buscar dados:", error);
        console.log("Usando dados mockados para demonstração...");
        
        // Usa dados mockados quando a API não está disponível
        fullTodayData = getMockData();
        renderDashboardForSectors(activeSectors);
        showConnectionError();
        
        // Adiciona indicador de que está usando dados mockados
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = `
                <span class="status-dot warning"></span>
                <span class="status-text">Modo Demonstração</span>
            `;
        }
    }
}

// Função principal que renderiza o painel para os setores selecionados
function renderDashboardForSectors(sectors) {
    activeSectors = sectors;
    const sectorData = fullTodayData.filter(item => sectors.includes(item['Canal Aberto']));
    
    const metrics = calculateGlobalMetrics(sectorData);
    updateMetricsUI(metrics);

    const geralWaitingData = sectorData.filter(isWaitingStatus);
    const humanWaitingData = sectorData.filter(isUnassigned);
    const franqueadosWaitingData = fullTodayData.filter(item => 
        item['Canal Aberto'] === 'NRS Franqueados' && isWaitingStatus(item)
    );
    
    renderQueue(geralWaitingData, 'geral-queue-list');
    renderQueue(franqueadosWaitingData, 'franqueados-queue-list');
    renderQueue(humanWaitingData, 'human-queue-list');
    
    // Atualiza contadores das filas
    document.getElementById('geral-queue-count').textContent = geralWaitingData.length;
    document.getElementById('franqueados-queue-count').textContent = franqueadosWaitingData.length;
    document.getElementById('human-queue-count').textContent = humanWaitingData.length;
    
    // Mostra/oculta a fila de franqueados baseado no setor selecionado
    const franqueadosQueue = document.getElementById('franqueados-queue');
    const contentWrapper = document.querySelector('.content-wrapper');
    
    if (sectors.includes('NRS Franqueados') || sectors.includes('NRS')) {
        franqueadosQueue.style.display = 'flex';
        contentWrapper.style.gridTemplateColumns = '280px 280px 280px 1fr';
    } else {
        franqueadosQueue.style.display = 'none';
        contentWrapper.style.gridTemplateColumns = '280px 280px 1fr';
    }
    
    const gridData = sectorData.filter(item => item.Status !== 'Atendimentos realizados no dia' && !isUnassigned(item));
    const groupedForGrid = groupData(gridData, 'Funcionário');
    renderAgentGrid(groupedForGrid);

    updateActiveTab();
}

// --- Funções de UI e Templates ---

function createTabButton(sectors, label) {
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.textContent = label;
    button.dataset.sectors = JSON.stringify(sectors); // Armazena os setores no botão
    button.addEventListener('click', () => {
        renderDashboardForSectors(sectors);
    });
    return button;
}

function updateActiveTab() {
    const buttons = document.querySelectorAll('.tab-button');
    const tabsContainer = document.getElementById('sector-tabs');
    
    buttons.forEach(button => {
        if (button.dataset.sectors === JSON.stringify(activeSectors)) {
            button.classList.add('active');
            
            // Scroll para a aba ativa se ela não estiver visível
            setTimeout(() => {
                const buttonRect = button.getBoundingClientRect();
                const containerRect = tabsContainer.getBoundingClientRect();
                
                if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
                    button.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }, 100);
        } else {
            button.classList.remove('active');
        }
    });
}

const groupData = (data, key) => data.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
}, {});

function renderQueue(queueData, elementId) {
    const queueList = document.getElementById(elementId);
    queueList.innerHTML = '';
    const template = document.getElementById('queue-item-template');
    queueData.sort((a, b) => parseDurationToSeconds(b['Criado em']) - parseDurationToSeconds(a['Criado em']));
    if (queueData.length === 0) {
        queueList.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-style: italic; padding: 40px 20px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px dashed var(--border-light);">Fila vazia.</p>';
        return;
    }
    queueData.forEach(item => {
        const queueItem = document.importNode(template.content, true);
        queueItem.querySelector('.queue-customer').textContent = item.Cliente || 'Sem Título';
        queueItem.querySelector('.queue-time').textContent = item['Criado em'];
        queueList.appendChild(queueItem);
    });
}

function renderAgentGrid(activeData) {
    const grid = document.getElementById('agent-grid');
    
    // Remove o container anterior se existir
    const existingContainer = grid.querySelector('.agent-grid-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Cria o novo container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'agent-grid-container';
    
    const template = document.getElementById('agent-card-template');
    const agentCount = Object.keys(activeData).length;
    
    if (agentCount === 0) {
        gridContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-style: italic; padding: 40px 20px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px dashed var(--border-light);">Nenhum agente em atendimento.</p>';
        grid.appendChild(gridContainer);
        return;
    }
    
    // Aplica classe baseada na quantidade de agentes
    if (agentCount <= 3) {
        gridContainer.classList.add('few-agents');
    } else if (agentCount <= 8) {
        gridContainer.classList.add('medium-agents');
    } else {
        gridContainer.classList.add('many-agents');
    }
    
    for (const agentName in activeData) {
        const chatCount = activeData[agentName].length;
        const card = document.importNode(template.content, true).firstElementChild;
        card.querySelector('.chat-count').textContent = chatCount;
        card.querySelector('.agent-name').textContent = agentName;
        card.querySelector('.status-text').textContent = getStatusText(chatCount);
        card.className = 'agent-card';
        card.classList.add(getStatusClass(chatCount));
        
        // Verifica se o agente está atendendo clientes do NRS Franqueados
        const hasFranqueadosClients = activeData[agentName].some(chat => 
            chat['Canal Aberto'] === 'NRS Franqueados'
        );
        
        if (hasFranqueadosClients) {
            card.classList.add('has-franqueados');
            // Adiciona indicador visual
            const franqueadosIndicator = document.createElement('div');
            franqueadosIndicator.className = 'franqueados-indicator';
            franqueadosIndicator.innerHTML = '<i class="fas fa-store"></i>';
            card.appendChild(franqueadosIndicator);
        }
        
        // Adiciona evento de clique para mostrar modal
        card.addEventListener('click', () => {
            showAgentModal(agentName, activeData[agentName]);
        });
        
        // Adiciona cursor pointer para indicar que é clicável
        card.style.cursor = 'pointer';
        
        gridContainer.appendChild(card);
    }
    
    grid.appendChild(gridContainer);
}

function getStatusText(count) {
    if (count === 0) return 'Disponível';
    if (count <= 2) return 'Normal';
    if (count <= 4) return 'Ocupado';
    return 'Sobrecarregado';
}

function calculateGlobalMetrics(data) {
    const completedChats = data.filter(item => item.Status === 'Atendimentos realizados no dia');
    const activeChats = data.filter(item => item.Status !== 'Atendimentos realizados no dia');
    const geralWaitingChats = data.filter(isWaitingStatus);
    const humanWaitingChats = data.filter(isUnassigned);
    const totalHandleTime = completedChats.reduce((sum, chat) => sum + parseDurationToSeconds(chat['Duração da conversa']), 0);
    const tma = completedChats.length > 0 ? totalHandleTime / completedChats.length : 0;
    const chatsWithResponseTime = data.filter(chat => chat['Tempo inicial de resposta'] && chat['Tempo inicial de resposta'] !== '-');
    const totalResponseTime = chatsWithResponseTime.reduce((sum, chat) => sum + parseDurationToSeconds(chat['Tempo inicial de resposta']), 0);
    const tmr = chatsWithResponseTime.length > 0 ? totalResponseTime / chatsWithResponseTime.length : 0;
    const chatsWithWaitTime = data.filter(chat => chat['Aguardando resposta do agente'] && chat['Aguardando resposta do agente'] !== '-');
    const totalWaitTime = chatsWithWaitTime.reduce((sum, chat) => sum + parseDurationToSeconds(chat['Aguardando resposta do agente']), 0);
    const tme = chatsWithWaitTime.length > 0 ? totalWaitTime / chatsWithWaitTime.length : 0;
    return {
        geralWaitingCount: geralWaitingChats.length,
        humanWaitingCount: humanWaitingChats.length,
        tma: formatSeconds(tma),
        tmr: formatSeconds(tmr),
        tme: formatSeconds(tme),
        activeChatsCount: activeChats.length,
        completedChatsCount: completedChats.length
    };
}

function updateMetricsUI(metrics) {
    document.getElementById('geral-queue-value').textContent = metrics.geralWaitingCount;
    document.getElementById('human-queue-value').textContent = metrics.humanWaitingCount;
    document.getElementById('tma-value').textContent = metrics.tma;
    document.getElementById('tmr-value').textContent = metrics.tmr;
    document.getElementById('tme-value').textContent = metrics.tme;
    document.getElementById('active-chats-value').textContent = metrics.activeChatsCount;
    document.getElementById('completed-chats-value').textContent = metrics.completedChatsCount;
}

const fetchData = async () => {
    const urls = isProduction ? [API_URL_PROXY, API_URL_CORS_PROXY, API_URL, API_URL_FALLBACK] : [API_URL_FALLBACK, API_URL, API_URL_CORS_PROXY];
    
    for (let i = 0; i < urls.length; i++) {
        try {
            console.log(`Tentando conectar com: ${urls[i]}`);
            const response = await fetch(urls[i]);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Conexão bem-sucedida!');
            return data;
        } catch (error) {
            console.error(`Erro ao conectar com ${urls[i]}:`, error);
            
            // Se não é a última tentativa, continua para a próxima URL
            if (i < urls.length - 1) {
                console.log('Tentando próxima URL...');
                continue;
            }
            
            // Se é a última tentativa, lança o erro
            throw error;
        }
    }
};
const filterByToday = (item) => parseDate(item['Modificado em'])?.toDateString() === new Date().toDateString();
const filterOutBots = (item) => !EXCLUDED_BOTS.includes(item.Funcionário);
const isWaitingStatus = (item) => item['Status (detalhado)'] === 'Cliente aguardando resposta do agente' || item['Status (detalhado)'] === 'Nova conversa iniciada';
const isUnassigned = (item) => !item.Funcionário || item.Funcionário.trim() === '—';

function getStatusClass(count) {
    if (count === 0) return 'status-idle';
    if (count <= 2) return 'status-normal';
    if (count <= 4) return 'status-busy';
    return 'status-overload';
}

function parseDurationToSeconds(timeString) {
    if (!timeString || typeof timeString !== 'string' || timeString === '-') return 0;
    const parts = timeString.split(' ');
    let totalSeconds = 0;
    for (let i = 0; i < parts.length; i += 2) {
        const value = parseInt(parts[i], 10);
        if (isNaN(value)) continue;
        const unit = parts[i + 1];
        if (unit.startsWith('minuto')) totalSeconds += value * 60;
        else if (unit.startsWith('segundo')) totalSeconds += value;
        else if (unit.startsWith('hora')) totalSeconds += value * 3600;
    }
    return totalSeconds;
}

function formatSeconds(seconds) {
    if (seconds === 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
}

const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return null;
    return new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]);
};

function initializeTabScrollControls() {
    const tabsContainer = document.getElementById('sector-tabs');
    const scrollLeftBtn = document.getElementById('scroll-left');
    const scrollRightBtn = document.getElementById('scroll-right');
    
    // Função para atualizar visibilidade dos botões
    function updateScrollButtons() {
        const isAtStart = tabsContainer.scrollLeft === 0;
        const isAtEnd = tabsContainer.scrollLeft >= tabsContainer.scrollWidth - tabsContainer.clientWidth;
        const hasScroll = tabsContainer.scrollWidth > tabsContainer.clientWidth;
        
        scrollLeftBtn.disabled = isAtStart;
        scrollRightBtn.disabled = isAtEnd;
        
        // Adiciona/remove classe para indicadores visuais
        if (hasScroll) {
            tabsContainer.classList.add('has-scroll');
        } else {
            tabsContainer.classList.remove('has-scroll');
        }
    }
    
    // Event listeners para os botões de scroll
    scrollLeftBtn.addEventListener('click', () => {
        tabsContainer.scrollBy({ left: -200, behavior: 'smooth' });
    });
    
    scrollRightBtn.addEventListener('click', () => {
        tabsContainer.scrollBy({ left: 200, behavior: 'smooth' });
    });
    
    // Atualiza botões quando o scroll muda
    tabsContainer.addEventListener('scroll', updateScrollButtons);
    
    // Atualiza botões inicialmente
    updateScrollButtons();
    
    // Atualiza botões quando a janela é redimensionada
    window.addEventListener('resize', updateScrollButtons);
}

function initializeModalControls() {
    const modal = document.getElementById('agent-modal');
    const closeBtn = document.getElementById('modal-close');
    
    // Fecha o modal ao clicar no botão X
    closeBtn.addEventListener('click', () => {
        closeModal();
    });
    
    // Fecha o modal ao clicar fora dele
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Fecha o modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });
}

function showAgentModal(agentName, agentData) {
    const modal = document.getElementById('agent-modal');
    const modalAgentName = document.getElementById('modal-agent-name');
    const modalAgentStatus = document.getElementById('modal-agent-status');
    const modalAgentCount = document.getElementById('modal-agent-count');
    const modalChatsList = document.getElementById('modal-chats-list');
    
    // Atualiza informações do agente
    modalAgentName.textContent = agentName;
    modalAgentCount.textContent = agentData.length;
    modalAgentStatus.textContent = getStatusText(agentData.length);
    
    // Renderiza lista de clientes
    modalChatsList.innerHTML = '';
    
    if (agentData.length === 0) {
        modalChatsList.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-style: italic;">Nenhum cliente em atendimento.</p>';
    } else {
        agentData.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            
            // Verifica se é do setor NRS Franqueados
            const isFranqueados = chat['Canal Aberto'] === 'NRS Franqueados';
            if (isFranqueados) {
                chatItem.classList.add('franqueados-chat');
            }
            
            chatItem.innerHTML = `
                <div class="chat-info">
                    <span class="chat-customer">${chat.Cliente || 'Sem Título'}</span>
                    <span class="chat-sector">${chat['Canal Aberto'] || '--'}</span>
                </div>
                <span class="chat-time">${chat['Criado em'] || '--'}</span>
            `;
            modalChatsList.appendChild(chatItem);
        });
    }
    
    // Mostra o modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('agent-modal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

function showConnectionError() {
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = `
            <span class="status-dot error"></span>
            <span class="status-text">Erro de Conexão</span>
        `;
    }
}

function hideConnectionError() {
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">Sistema Online</span>
        `;
    }
}

// Sistema de rotação automática dos setores
let autoRotationInterval = null;
let isAutoRotationActive = false;
let currentRotationIndex = 0;

// Lista de todos os setores disponíveis para rotação (será preenchida dinamicamente)
let allSectors = [];

// Função para detectar os setores disponíveis no menu
function detectAvailableSectors() {
    const sectorButtons = document.querySelectorAll('#sector-tabs button');
    const sectors = [];
    
    sectorButtons.forEach(button => {
        const sectorName = button.textContent.trim();
        if (sectorName && !sectors.includes(sectorName)) {
            sectors.push(sectorName);
        }
    });
    
    // Agrupa setores relacionados (como NRS e NRS Franqueados)
    const groupedSectors = [];
    let currentGroup = [];
    
    sectors.forEach(sector => {
        if (sector === 'NRS' || sector === 'NRS Franqueados') {
            if (currentGroup.length === 0) {
                currentGroup = [sector];
            } else if (currentGroup.includes('NRS') || currentGroup.includes('NRS Franqueados')) {
                currentGroup.push(sector);
            } else {
                if (currentGroup.length > 0) {
                    groupedSectors.push([...currentGroup]);
                }
                currentGroup = [sector];
            }
        } else {
            if (currentGroup.length > 0) {
                groupedSectors.push([...currentGroup]);
                currentGroup = [];
            }
            groupedSectors.push([sector]);
        }
    });
    
    // Adiciona o último grupo se existir
    if (currentGroup.length > 0) {
        groupedSectors.push([...currentGroup]);
    }
    
    allSectors = groupedSectors;
    console.log('Setores detectados para rotação:', allSectors);
    
    return groupedSectors;
}

// Função para iniciar a rotação automática
function startAutoRotation() {
    if (autoRotationInterval) return;
    
    // Detecta os setores disponíveis antes de iniciar
    if (allSectors.length === 0) {
        detectAvailableSectors();
    }
    
    if (allSectors.length === 0) {
        console.log('Nenhum setor disponível para rotação');
        return;
    }
    
    isAutoRotationActive = true;
    currentRotationIndex = 0;
    
    // Atualiza o indicador visual
    updateAutoRotationIndicator();
    
    // Mostra o indicador do setor atual
    const currentSectors = allSectors[currentRotationIndex];
    showCurrentSectorDisplay(currentSectors);
    
    // Inicia o intervalo de rotação
    autoRotationInterval = setInterval(() => {
        rotateToNextSector();
    }, rotationInterval);
    
    console.log(`Rotação automática iniciada - ${rotationInterval/1000} segundos por setor. Total de setores: ${allSectors.length}`);
}

// Função para parar a rotação automática
function stopAutoRotation() {
    if (autoRotationInterval) {
        clearInterval(autoRotationInterval);
        autoRotationInterval = null;
    }
    
    // Limpa o intervalo da barra de progresso
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }
    
    isAutoRotationActive = false;
    updateAutoRotationIndicator();
    
    // Esconde o indicador de setor atual
    hideCurrentSectorDisplay();
    
    console.log('Rotação automática parada');
}

// Função para rotacionar para o próximo setor
function rotateToNextSector() {
    if (!isAutoRotationActive) return;
    
    currentRotationIndex = (currentRotationIndex + 1) % allSectors.length;
    const nextSectors = allSectors[currentRotationIndex];
    
    // Atualiza os setores ativos
    activeSectors = nextSectors;
    
    // Atualiza as abas ativas
    updateActiveTab();
    
    // Renderiza o dashboard para os novos setores
    renderDashboardForSectors(nextSectors);
    
    // Atualiza o indicador de setor atual
    updateCurrentSectorDisplay(nextSectors);
    
    console.log(`Rotacionando para: ${nextSectors.join(', ')}`);
}

// Função para atualizar o indicador visual da rotação
function updateAutoRotationIndicator() {
    const statusIndicator = document.querySelector('.status-indicator');
    if (!statusIndicator) return;
    
    if (isAutoRotationActive) {
        statusIndicator.innerHTML = `
            <span class="status-dot auto-rotation"></span>
            <span class="status-text">Rotação Automática</span>
        `;
    } else {
        statusIndicator.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">Sistema Online</span>
        `;
    }
}

// Função para mostrar o indicador de setor atual
function showCurrentSectorDisplay(sectorNames) {
    const sectorDisplay = document.getElementById('current-sector-display');
    const sectorNameElement = sectorDisplay.querySelector('.sector-name');
    const progressBar = sectorDisplay.querySelector('.progress-bar');
    
    if (!sectorDisplay) return;
    
    // Atualiza o nome do setor
    sectorNameElement.textContent = sectorNames.join(' + ');
    
    // Mostra o indicador
    sectorDisplay.classList.remove('hidden');
    sectorDisplay.classList.add('show');
    
    // Inicia a barra de progresso
    startProgressBar(progressBar);
    
    // Ativa o destaque da fila "Aguardando Humano"
    activateHumanQueueHighlight();
    
    console.log(`Indicador de setor exibido: ${sectorNames.join(', ')}`);
}

// Função para esconder o indicador de setor atual
function hideCurrentSectorDisplay() {
    const sectorDisplay = document.getElementById('current-sector-display');
    if (!sectorDisplay) return;
    
    sectorDisplay.classList.remove('show');
    sectorDisplay.classList.add('hidden');
    
    // Desativa o destaque da fila "Aguardando Humano"
    deactivateHumanQueueHighlight();
    
    console.log('Indicador de setor ocultado');
}

// Função para iniciar a barra de progresso
function startProgressBar(progressBar) {
    if (!progressBar) return;
    
    // Limpa qualquer intervalo anterior
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }
    
    // Reseta a barra
    progressBar.style.width = '0%';
    
    // Atualiza o indicador de tempo
    updateTimeRemaining(rotationInterval / 1000);
    
    // Anima a barra de 0% a 100% no tempo configurado
    let progress = 0;
    const stepTime = 50; // Atualiza a cada 50ms para movimento mais suave
    const totalSteps = rotationInterval / stepTime;
    const progressIncrement = 100 / totalSteps;
    
    window.progressInterval = setInterval(() => {
        progress += progressIncrement;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(window.progressInterval);
            window.progressInterval = null;
            updateTimeRemaining(0);
        }
        
        progressBar.style.width = `${progress}%`;
        
        // Atualiza o tempo restante
        const remainingSeconds = Math.ceil((100 - progress) * (rotationInterval / 1000) / 100);
        updateTimeRemaining(remainingSeconds);
    }, stepTime);
}

// Função para atualizar o tempo restante
function updateTimeRemaining(seconds) {
    const timeRemainingElement = document.querySelector('.time-remaining');
    if (timeRemainingElement) {
        if (seconds <= 0) {
            timeRemainingElement.textContent = '0s';
        } else if (seconds < 60) {
            timeRemainingElement.textContent = `${seconds}s`;
        } else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            timeRemainingElement.textContent = `${minutes}m ${remainingSeconds}s`;
        }
    }
}

// Função para atualizar o indicador de setor atual
function updateCurrentSectorDisplay(sectorNames) {
    const sectorDisplay = document.getElementById('current-sector-display');
    const sectorNameElement = sectorDisplay.querySelector('.sector-name');
    const progressBar = sectorDisplay.querySelector('.progress-bar');
    
    if (!sectorDisplay || !isAutoRotationActive) return;
    
    // Atualiza o nome do setor
    sectorNameElement.textContent = sectorNames.join(' + ');
    
    // Pequeno delay para garantir que a barra anterior seja limpa
    setTimeout(() => {
        startProgressBar(progressBar);
    }, 100);
    
    console.log(`Indicador de setor atualizado: ${sectorNames.join(', ')}`);
}

// Função para alternar a rotação automática
function toggleAutoRotation() {
    if (isAutoRotationActive) {
        stopAutoRotation();
    } else {
        startAutoRotation();
    }
}



// Inicializar controles de rotação automática
function initializeAutoRotationControls() {
    const toggleBtn = document.getElementById('toggle-auto-rotation');
    const stopBtn = document.getElementById('stop-rotation-display');
    const timerInput = document.getElementById('rotation-timer');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleAutoRotation();
            updateToggleButtonIcon();
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            stopAutoRotation();
            updateToggleButtonIcon();
        });
    }
    
    if (timerInput) {
        // Define o valor inicial
        timerInput.value = rotationInterval / 1000;
        
        // Event listener para mudanças no input
        timerInput.addEventListener('change', (e) => {
            const newValue = parseInt(e.target.value);
            if (updateRotationInterval(newValue)) {
                e.target.value = newValue;
            } else {
                e.target.value = rotationInterval / 1000; // Reverte para o valor atual
            }
        });
        
        // Event listener para pressionar Enter
        timerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const newValue = parseInt(e.target.value);
                if (updateRotationInterval(newValue)) {
                    e.target.value = newValue;
                    e.target.blur(); // Remove o foco
                } else {
                    e.target.value = rotationInterval / 1000;
                }
            }
        });
    }
}

// Função para atualizar o ícone do botão de toggle
function updateToggleButtonIcon() {
    const toggleBtn = document.getElementById('toggle-auto-rotation');
    if (!toggleBtn) return;
    
    const icon = toggleBtn.querySelector('i');
    if (isAutoRotationActive) {
        icon.className = 'fas fa-pause';
        toggleBtn.classList.add('pause');
        toggleBtn.title = 'Parar Rotação Automática';
    } else {
        icon.className = 'fas fa-play';
        toggleBtn.classList.remove('pause');
        toggleBtn.title = 'Iniciar Rotação Automática';
    }
}

// Função para atualizar a lista de setores quando o menu for modificado
function updateAvailableSectors() {
    // Para a rotação automática se estiver ativa
    if (isAutoRotationActive) {
        stopAutoRotation();
    }
    
    // Redetecta os setores disponíveis
    detectAvailableSectors();
    
    // Reseta o índice de rotação
    currentRotationIndex = 0;
    
    console.log('Lista de setores atualizada:', allSectors);
}

// Função para obter informações sobre os setores disponíveis
function getSectorsInfo() {
    if (allSectors.length === 0) {
        detectAvailableSectors();
    }
    
    return {
        total: allSectors.length,
        current: currentRotationIndex + 1,
        sectors: allSectors,
        isActive: isAutoRotationActive,
        interval: rotationInterval / 1000
    };
}

// Função para atualizar o tempo de rotação
function updateRotationInterval(newIntervalSeconds) {
    if (newIntervalSeconds < 5 || newIntervalSeconds > 300) {
        console.log('Tempo inválido. Deve ser entre 5 e 300 segundos.');
        return false;
    }
    
    rotationInterval = newIntervalSeconds * 1000;
    rotationIntervalMinutes = newIntervalSeconds / 60;
    
    // Se a rotação estiver ativa, reinicia com o novo tempo
    if (isAutoRotationActive) {
        stopAutoRotation();
        startAutoRotation();
    }
    
    console.log(`Tempo de rotação atualizado para ${newIntervalSeconds} segundos`);
    return true;
}

// Função para obter o tempo de rotação atual
function getCurrentRotationInterval() {
    return {
        seconds: rotationInterval / 1000,
        minutes: rotationIntervalMinutes,
        milliseconds: rotationInterval
    };
}

// Função para ativar o destaque da fila "Aguardando Humano"
function activateHumanQueueHighlight() {
    const humanQueue = document.getElementById('human-queue');
    const aguardandoHumanoCard = document.getElementById('aguardando-humano-card');
    
    if (humanQueue) {
        humanQueue.classList.add('auto-rotation-active');
        console.log('Destaque da fila "Aguardando Humano" ativado');
    }
    
    if (aguardandoHumanoCard) {
        aguardandoHumanoCard.classList.add('auto-rotation-active');
        console.log('Destaque do card "AGUARDANDO HUMANO" ativado');
    }
}

// Função para desativar o destaque da fila "Aguardando Humano"
function deactivateHumanQueueHighlight() {
    const humanQueue = document.getElementById('human-queue');
    const aguardandoHumanoCard = document.getElementById('aguardando-humano-card');
    
    if (humanQueue) {
        humanQueue.classList.remove('auto-rotation-active');
        console.log('Destaque da fila "Aguardando Humano" desativado');
    }
    
    if (aguardandoHumanoCard) {
        aguardandoHumanoCard.classList.remove('auto-rotation-active');
        console.log('Destaque do card "AGUARDANDO HUMANO" desativado');
    }
}