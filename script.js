// Google-Style AI Chat Client with OpenRouter-like Model Selection
class GoogleAIChat {
  constructor() {
    this.config = {
      baseUrl: 'http://localhost:8000',
      maxRetries: 3,
      retryDelay: 1000,
      maxMessageLength: 32000
    };
    
    this.state = {
      isConnected: false,
      isGenerating: false,
      currentModel: null,
      selectedModel: null,
      models: [],
      filteredModels: [],
      messages: [],
      sidebarOpen: false,
      settings: this.getDefaultSettings(),
      usage: { totalTokensUsed: 0, limit: 10000 }
    };
    
    this.elements = {};
    this.init();
  }
  
  getDefaultSettings() {
    return {
      temperature: 0.7,
      maxTokens: 4096,
      streaming: true,
      darkMode: false,
      autoScroll: true
    };
  }
  
  async init() {
    this.initializeDOM();
    this.setupEventListeners();
    this.loadSettings();
    this.applyTheme();
    
    // Configure marked.js
    marked.setOptions({
      highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
    
    await this.checkConnection();
    await this.loadModels();
    this.setupPeriodicUpdates();
    
    this.showToast('Welcome to Gemini AI Studio!', 'success');
  }
  
  initializeDOM() {
    const selectors = {
      // Sidebar
      sidebar: '#sidebar',
      sidebarToggle: '#sidebarToggle',
      modelSearch: '#modelSearch',
      modelsContainer: '#modelsContainer',
      
      // Header
      connectionStatus: '#connectionStatus',
      settingsBtn: '#settingsBtn',
      helpBtn: '#helpBtn',
      
      // Model
      modelHeader: '#modelHeader',
      changeModelBtn: '#changeModelBtn',
      newChatBtn: '#newChatBtn',
      contextLength: '#contextLength',
      modelCost: '#modelCost',
      
      // Usage
      usageBar: '#usageBar',
      usageCount: '#usageCount',
      usageFill: '#usageFill',
      
      // Chat
      welcomeScreen: '#welcomeScreen',
      chatArea: '#chatArea',
      chatMessages: '#chatMessages',
      
      // Input
      messageInput: '#messageInput',
      sendBtn: '#sendBtn',
      loadingAnimation: '#loadingAnimation',
      charCount: '#charCount',
      attachBtn: '#attachBtn',
      voiceBtn: '#voiceBtn',
      
      // Settings Modal
      settingsModal: '#settingsModal',
      closeSettings: '#closeSettings',
      temperatureSlider: '#temperatureSlider',
      tempValue: '#tempValue',
      maxTokensSlider: '#maxTokensSlider',
      tokensValue: '#tokensValue',
      streamToggle: '#streamToggle',
      darkModeToggle: '#darkModeToggle',
      autoScrollToggle: '#autoScrollToggle',
      resetSettings: '#resetSettings',
      saveSettings: '#saveSettings',
      
      // Other
      toastContainer: '#toastContainer',
      mainContent: '.main-content'
    };
    
    for (const [key, selector] of Object.entries(selectors)) {
      this.elements[key] = document.querySelector(selector);
    }
  }
  
  setupEventListeners() {
    // Sidebar toggle
    this.elements.sidebarToggle?.addEventListener('click', () => {
      this.toggleSidebar();
    });
    
    // Model search
    this.elements.modelSearch?.addEventListener('input', (e) => {
      this.filterModels(e.target.value);
    });
    
    // Category filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.filterModelsByCategory(e.target.dataset.category);
      });
    });
    
    // Model actions
    this.elements.changeModelBtn?.addEventListener('click', () => {
      this.openSidebar();
    });
    
    this.elements.newChatBtn?.addEventListener('click', () => {
      this.startNewChat();
    });
    
    // Input handling
    this.elements.messageInput?.addEventListener('input', () => {
      this.handleInputChange();
    });
    
    this.elements.messageInput?.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });
    
    // Send message
    this.elements.sendBtn?.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        if (prompt) {
          this.elements.messageInput.value = prompt;
          this.handleInputChange();
          this.elements.messageInput.focus();
        }
      });
    });
    
    // Settings
    this.elements.settingsBtn?.addEventListener('click', () => {
      this.openSettings();
    });
    
    this.elements.closeSettings?.addEventListener('click', () => {
      this.closeSettings();
    });
    
    // Settings controls
    this.elements.temperatureSlider?.addEventListener('input', (e) => {
      this.elements.tempValue.textContent = e.target.value;
    });
    
    this.elements.maxTokensSlider?.addEventListener('input', (e) => {
      this.elements.tokensValue.textContent = e.target.value;
    });
    
    this.elements.resetSettings?.addEventListener('click', () => {
      this.resetSettings();
    });
    
    this.elements.saveSettings?.addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Modal backdrop
    this.elements.settingsModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) {
        this.closeSettings();
      }
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettings();
        this.closeSidebar();
      }
    });
    
    // Help button
    this.elements.helpBtn?.addEventListener('click', () => {
      this.showToast('Help documentation coming soon!', 'info');
    });
    
    // Voice button
    this.elements.voiceBtn?.addEventListener('click', () => {
      this.showToast('Voice input coming soon!', 'info');
    });
  }
  
  async checkConnection() {
    try {
      this.updateConnectionStatus('connecting');
      
      const response = await fetch(`${this.config.baseUrl}/api/health`);
      const data = await response.json();
      
      if (data.status === 'ok') {
        this.state.isConnected = true;
        this.updateConnectionStatus('connected');
        await this.fetchUsage();
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      this.state.isConnected = false;
      this.updateConnectionStatus('disconnected');
      setTimeout(() => this.checkConnection(), 5000);
    }
  }
  
  updateConnectionStatus(status) {
    const statusElement = this.elements.connectionStatus;
    const dot = statusElement.querySelector('.connection-dot');
    const text = statusElement.querySelector('.connection-text');
    
    dot.className = 'connection-dot';
    
    switch (status) {
      case 'connected':
        dot.classList.add('connected');
        text.textContent = 'Connected';
        break;
      case 'connecting':
        dot.classList.add('connecting');
        text.textContent = 'Connecting...';
        break;
      case 'disconnected':
      default:
        dot.classList.add('disconnected');
        text.textContent = 'Disconnected';
        break;
    }
  }
  
  async loadModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/models`);
      const data = await response.json();
      
      if (data.models && Array.isArray(data.models)) {
        // Transform to OpenRouter-like format
        this.state.models = data.models.map(model => ({
          id: model.name,
          name: model.displayName,
          description: this.getModelDescription(model.name),
          context_length: model.inputTokenLimit || 'Unknown',
          pricing: { completion: 'Free', prompt: 'Free' },
          provider: this.getModelProvider(model.name),
          category: this.getModelCategory(model.name)
        }));
        
        this.state.filteredModels = [...this.state.models];
        this.renderModels();
        
        // Auto-select first model
        if (this.state.models.length > 0) {
          this.selectModel(this.state.models[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      this.showToast('Failed to load models', 'error');
    }
  }
  
  getModelDescription(modelName) {
    const descriptions = {
      'models/gemini-1.0-pro': 'Fast and efficient for most tasks',
      'models/gemini-1.5-flash': 'Lightning fast responses with good quality',
      'models/gemini-1.5-pro': 'Most capable model with large context window',
      'models/gemini-2.5-flash-preview-04-17': 'Latest preview with enhanced capabilities',
      'models/gemini-pro': 'General purpose conversational AI',
      'models/gemini-pro-vision': 'Multimodal model supporting text and images'
    };
    return descriptions[modelName] || 'Advanced AI language model';
  }
  
  getModelProvider(modelName) {
    if (modelName.includes('gemini')) return 'Google';
    if (modelName.includes('gpt')) return 'OpenAI';
    if (modelName.includes('claude')) return 'Anthropic';
    if (modelName.includes('llama')) return 'Meta';
    return 'Google';
  }
  
  getModelCategory(modelName) {
    if (modelName.includes('gemini')) return 'gemini';
    if (modelName.includes('gpt')) return 'gpt';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('llama')) return 'llama';
    return 'gemini';
  }
  
  renderModels() {
    const container = this.elements.modelsContainer;
    
    if (this.state.filteredModels.length === 0) {
      container.innerHTML = `
        <div class="models-loading">
          <span class="material-icons-round">search_off</span>
          <span>No models found</span>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.state.filteredModels.map(model => `
      <div class="model-card ${this.state.selectedModel?.id === model.id ? 'selected' : ''}" 
           data-model-id="${model.id}">
        <div class="model-card-icon">
          <span class="material-icons-round">${this.getModelIcon(model.provider)}</span>
        </div>
        <div class="model-card-content">
          <div class="model-card-name">${model.name}</div>
          <div class="model-card-description">${model.description}</div>
          <div class="model-card-stats">
            <div class="model-card-stat">
              <span class="material-icons-round">memory</span>
              <span>${this.formatContextLength(model.context_length)}</span>
            </div>
            <div class="model-card-stat">
              <span class="material-icons-round">speed</span>
              <span>${model.provider}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
    // Add click listeners
    container.querySelectorAll('.model-card').forEach(card => {
      card.addEventListener('click', () => {
        const modelId = card.dataset.modelId;
        const model = this.state.models.find(m => m.id === modelId);
        if (model) {
          this.selectModel(model);
          this.closeSidebar();
        }
      });
    });
  }
  
  getModelIcon(provider) {
    const icons = {
      'Google': 'smart_toy',
      'OpenAI': 'psychology',
      'Anthropic': 'school',
      'Meta': 'auto_awesome'
    };
    return icons[provider] || 'smart_toy';
  }
  
  formatContextLength(length) {
    if (typeof length === 'number') {
      return length >= 1000000 ? `${(length / 1000000).toFixed(1)}M` : `${(length / 1000).toFixed(0)}K`;
    }
    return length;
  }
  
  selectModel(model) {
    this.state.selectedModel = model;
    this.state.currentModel = model.id;
    
    // Update UI
    const modelName = this.elements.modelHeader.querySelector('.model-name');
    const modelDescription = this.elements.modelHeader.querySelector('.model-description');
    
    if (modelName) modelName.textContent = model.name;
    if (modelDescription) modelDescription.textContent = model.description;
    
    this.elements.contextLength.textContent = this.formatContextLength(model.context_length);
    this.elements.modelCost.textContent = model.pricing.completion;
    
    // Update model cards selection
    document.querySelectorAll('.model-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.modelId === model.id);
    });
    
    // Hide welcome screen if showing
    this.hideWelcomeScreen();
    
    this.updateSendButton();
  }
  
  filterModels(searchTerm) {
    const term = searchTerm.toLowerCase();
    this.state.filteredModels = this.state.models.filter(model =>
      model.name.toLowerCase().includes(term) ||
      model.description.toLowerCase().includes(term) ||
      model.provider.toLowerCase().includes(term)
    );
    this.renderModels();
  }
  
  filterModelsByCategory(category) {
    if (category === 'all' || !category) {
      this.state.filteredModels = [...this.state.models];
    } else {
      this.state.filteredModels = this.state.models.filter(model =>
        model.category === category
      );
    }
    this.renderModels();
  }
  
  toggleSidebar() {
    this.state.sidebarOpen ? this.closeSidebar() : this.openSidebar();
  }
  
  openSidebar() {
    this.state.sidebarOpen = true;
    this.elements.sidebar.classList.add('open');
    this.elements.mainContent.classList.add('sidebar-open');
  }
  
  closeSidebar() {
    this.state.sidebarOpen = false;
    this.elements.sidebar.classList.remove('open');
    this.elements.mainContent.classList.remove('sidebar-open');
  }
  
  hideWelcomeScreen() {
    if (this.elements.welcomeScreen) {
      this.elements.welcomeScreen.style.display = 'none';
    }
  }
  
  showWelcomeScreen() {
    if (this.elements.welcomeScreen) {
      this.elements.welcomeScreen.style.display = 'flex';
    }
  }
  
  handleInputChange() {
    const input = this.elements.messageInput;
    const counter = this.elements.charCount;
    
    // Auto-resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    
    // Update counter
    const length = input.value.length;
    counter.textContent = length.toLocaleString();
    
    // Color coding
    if (length > this.config.maxMessageLength * 0.9) {
      counter.style.color = 'var(--error)';
    } else if (length > this.config.maxMessageLength * 0.7) {
      counter.style.color = 'var(--warning)';
    } else {
      counter.style.color = 'var(--text-tertiary)';
    }
    
    this.updateSendButton();
  }
  
  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }
  
  updateSendButton() {
    const canSend = this.state.currentModel &&
                   this.elements.messageInput.value.trim() &&
                   !this.state.isGenerating &&
                   this.state.isConnected;
    
    this.elements.sendBtn.disabled = !canSend;
  }
  
  async sendMessage() {
    const message = this.elements.messageInput.value.trim();
    
    if (!message || !this.state.currentModel || this.state.isGenerating) {
      return;
    }
    
    // Add user message
    this.addMessage({
      type: 'user',
      content: message,
      timestamp: new Date()
    });
    
    // Clear input
    this.elements.messageInput.value = '';
    this.elements.messageInput.style.height = 'auto';
    this.handleInputChange();
    
    // Show typing indicator
    this.showTypingIndicator();
    
    this.state.isGenerating = true;
    this.updateSendButton();
    this.updateSendButtonLoading(true);
    
    try {
      if (this.state.settings.streaming) {
        await this.generateStreamingResponse(message);
      } else {
        await this.generateResponse(message);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      this.showToast('Failed to generate response', 'error');
      this.addMessage({
        type: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        model: this.state.currentModel
      });
    } finally {
      this.hideTypingIndicator();
      this.state.isGenerating = false;
      this.updateSendButton();
      this.updateSendButtonLoading(false);
      await this.fetchUsage();
    }
  }
  
  async generateStreamingResponse(message) {
    const payload = {
      message: message,
      model: this.state.currentModel,
      options: {
        temperature: this.state.settings.temperature,
        maxTokens: this.state.settings.maxTokens
      },
      format: 'json'
    };
    
    const response = await fetch(`${this.config.baseUrl}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const botMessage = {
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      model: this.state.currentModel,
      streaming: true
    };
    
    const messageElement = this.addMessage(botMessage);
    const contentElement = messageElement.querySelector('.message-content');
    
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.chunk && !data.done) {
                botMessage.content += data.chunk;
                contentElement.innerHTML = marked.parse(botMessage.content);
                
                if (this.state.settings.autoScroll) {
                  this.scrollToBottom();
                }
              } else if (data.done) {
                if (data.usage) {
                  this.updateUsageDisplay(data.usage);
                }
                if (data.warning) {
                  this.showToast(data.warning, 'warning');
                }
              }
            } catch (e) {
              botMessage.content += line;
              contentElement.innerHTML = marked.parse(botMessage.content);
            }
          }
        }
      }
    } finally {
      botMessage.streaming = false;
      this.state.messages.push(botMessage);
      this.addMessageActions(messageElement);
    }
  }
  
  async generateResponse(message) {
    const payload = {
      message: message,
      model: this.state.currentModel,
      options: {
        temperature: this.state.settings.temperature,
        maxTokens: this.state.settings.maxTokens
      }
    };
    
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    this.addMessage({
      type: 'assistant',
      content: data.response,
      timestamp: new Date(),
      model: this.state.currentModel,
      usage: data.usage
    });
    
    if (data.usage) {
      this.updateUsageDisplay(data.usage);
    }
    
    if (data.warning) {
      this.showToast(data.warning, 'warning');
    }
  }
  
  addMessage(message) {
    const container = this.elements.chatMessages;
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.type}`;
    
    const timestamp = message.timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (message.type === 'user') {
      messageElement.innerHTML = `
        <div class="message-bubble">
          <div class="message-content">${this.escapeHtml(message.content)}</div>
          <div class="message-meta">
            <span class="timestamp">${timestamp}</span>
            <div class="message-actions">
              <button class="action-btn copy-btn" title="Copy">
                <span class="material-icons-round">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      messageElement.innerHTML = `
        <div class="message-bubble">
          <div class="message-content">${marked.parse(message.content)}</div>
          <div class="message-meta">
            <span class="timestamp">${timestamp}</span>
            <div class="message-actions">
              <button class="action-btn copy-btn" title="Copy">
                <span class="material-icons-round">content_copy</span>
              </button>
              <button class="action-btn regenerate-btn" title="Regenerate">
                <span class="material-icons-round">refresh</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }
    
    container.appendChild(messageElement);
    
    if (!message.streaming) {
      this.state.messages.push(message);
      this.addMessageActions(messageElement);
    }
    
    if (this.state.settings.autoScroll) {
      this.scrollToBottom();
    }
    
    return messageElement;
  }
  
  addMessageActions(messageElement) {
    const copyBtn = messageElement.querySelector('.copy-btn');
    const regenerateBtn = messageElement.querySelector('.regenerate-btn');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const textElement = messageElement.querySelector('.message-content');
        const text = textElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Copied to clipboard', 'success');
        });
      });
    }
    
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => {
        // Find previous user message and regenerate
        const messages = Array.from(this.elements.chatMessages.children);
        const currentIndex = messages.indexOf(messageElement);
        
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (messages[i].classList.contains('user')) {
            const userMsg = messages[i].querySelector('.message-content').textContent;
            
            // Remove messages from current to end
            for (let j = messages.length - 1; j >= currentIndex; j--) {
              messages[j].remove();
            }
            
            this.regenerateResponse(userMsg);
            break;
          }
        }
      });
    }
  }
  
  async regenerateResponse(message) {
    this.showTypingIndicator();
    this.state.isGenerating = true;
    this.updateSendButton();
    this.updateSendButtonLoading(true);
    
    try {
      if (this.state.settings.streaming) {
        await this.generateStreamingResponse(message);
      } else {
        await this.generateResponse(message);
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      this.showToast('Failed to regenerate response', 'error');
    } finally {
      this.hideTypingIndicator();
      this.state.isGenerating = false;
      this.updateSendButton();
      this.updateSendButtonLoading(false);
    }
  }
  
  showTypingIndicator() {
    const existing = document.querySelector('.typing-indicator');
    if (existing) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span>Gemini is thinking...</span>
    `;
    
    this.elements.chatMessages.appendChild(indicator);
    
    if (this.state.settings.autoScroll) {
      this.scrollToBottom();
    }
  }
  
  hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
  
  updateSendButtonLoading(loading) {
    if (loading) {
      this.elements.sendBtn.classList.add('loading');
    } else {
      this.elements.sendBtn.classList.remove('loading');
    }
  }
  
  async fetchUsage() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/usage`);
      const data = await response.json();
      
      this.state.usage = {
        totalTokensUsed: data.totalTokensUsed || 0,
        limit: data.limit || 10000,
        remaining: data.remaining || 0,
        exceeded: data.exceeded || false
      };
      
      this.updateUsageDisplay(this.state.usage);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  }
  
  updateUsageDisplay(usage) {
    const percentage = (usage.totalTokensUsed / usage.limit) * 100;
    
    this.elements.usageFill.style.width = `${Math.min(percentage, 100)}%`;
    this.elements.usageCount.textContent = 
      `${usage.totalTokensUsed?.toLocaleString()} / ${usage.limit?.toLocaleString()}`;
    
    // Color coding
    this.elements.usageFill.className = 'usage-fill';
    if (percentage >= 100) {
      this.elements.usageFill.classList.add('danger');
    } else if (percentage >= 90) {
      this.elements.usageFill.classList.add('warning');
    }
  }
  
  startNewChat() {
    if (this.state.messages.length === 0) return;
    
    if (confirm('Start a new chat? This will clear the current conversation.')) {
      this.state.messages = [];
      this.elements.chatMessages.innerHTML = '';
      this.showWelcomeScreen();
      this.showToast('New chat started', 'success');
    }
  }
  
  openSettings() {
    // Load current settings
    this.elements.temperatureSlider.value = this.state.settings.temperature;
    this.elements.tempValue.textContent = this.state.settings.temperature;
    this.elements.maxTokensSlider.value = this.state.settings.maxTokens;
    this.elements.tokensValue.textContent = this.state.settings.maxTokens;
    this.elements.streamToggle.checked = this.state.settings.streaming;
    this.elements.darkModeToggle.checked = this.state.settings.darkMode;
    this.elements.autoScrollToggle.checked = this.state.settings.autoScroll;
    
    this.elements.settingsModal.classList.add('active');
  }
  
  closeSettings() {
    this.elements.settingsModal.classList.remove('active');
  }
  
  saveSettings() {
    this.state.settings = {
      temperature: parseFloat(this.elements.temperatureSlider.value),
      maxTokens: parseInt(this.elements.maxTokensSlider.value),
      streaming: this.elements.streamToggle.checked,
      darkMode: this.elements.darkModeToggle.checked,
      autoScroll: this.elements.autoScrollToggle.checked
    };
    
    localStorage.setItem('geminiSettings', JSON.stringify(this.state.settings));
    this.applyTheme();
    this.closeSettings();
    this.showToast('Settings saved', 'success');
  }
  
  resetSettings() {
    this.state.settings = this.getDefaultSettings();
    localStorage.removeItem('geminiSettings');
    this.openSettings();
    this.showToast('Settings reset', 'success');
  }
  
  loadSettings() {
    const saved = localStorage.getItem('geminiSettings');
    if (saved) {
      try {
        this.state.settings = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }
  
  applyTheme() {
    document.documentElement.setAttribute(
      'data-theme',
      this.state.settings.darkMode ? 'dark' : 'light'
    );
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  scrollToBottom() {
    this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
  }
  
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="material-icons-round">
        ${type === 'success' ? 'check_circle' : 
          type === 'error' ? 'error' : 
          type === 'warning' ? 'warning' : 'info'}
      </span>
      <span>${message}</span>
    `;
    
    this.elements.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  setupPeriodicUpdates() {
    setInterval(() => {
      if (!this.state.isConnected) {
        this.checkConnection();
      }
    }, 30000);
    
    setInterval(() => {
      if (this.state.isConnected) {
        this.fetchUsage();
      }
    }, 60000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.googleAI = new GoogleAIChat();
});
