import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types';

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  lastMessage?: string;
}

// 模型设置对话框组件
const ModelSettingsDialog: React.FC<{
  show: boolean;
  settings: {name: string; baseUrl: string; apiKey: string};
  onSave: (settings: {name: string; baseUrl: string; apiKey: string}) => void;
  onCancel: () => void;
}> = ({ show, settings, onSave, onCancel }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  // 当settings属性变化时，同步更新localSettings
  useEffect(() => {
    if (show) {
      setLocalSettings(settings);
      setTestResult(null); // 重置测试结果
    }
  }, [settings, show]);

  const handleTest = async () => {
    // 验证输入完整性
    if (!localSettings.name || !localSettings.baseUrl || !localSettings.apiKey) {
      const missingFields = [];
      if (!localSettings.name) missingFields.push('模型名称');
      if (!localSettings.baseUrl) missingFields.push('API Base');
      if (!localSettings.apiKey) missingFields.push('API Key');
      
      setTestResult({
        success: false,
        message: `请填写: ${missingFields.join(', ')}`
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      console.log('[' + new Date().toISOString() + '] 开始测试API连接');
      const testStartTime = Date.now();
      
      // 1. 先测试URL格式
      let testUrl;
      try {
        testUrl = new URL(localSettings.baseUrl);
        if (!['http:', 'https:'].includes(testUrl.protocol)) {
          throw new Error('协议必须为http或https');
        }
        console.log('URL格式验证通过:', testUrl.origin);
      } catch (urlError) {
        setTestResult({
          success: false,
          message: `API Base格式错误: ${urlError instanceof Error ? urlError.message : '无效的URL'}`
        });
        return;
      }

      // 2. 测试API连接
      console.log('发送测试请求到:', testUrl.origin);
      const response = await fetch(`${localSettings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: localSettings.name,
          messages: [{
            role: 'user',
            content: '你好，这是一个连接测试'
          }],
          stream: false,
          max_tokens: 10,
        }),
      });

      const testEndTime = Date.now();
      console.log('[' + new Date().toISOString() + '] 测试API请求完成，耗时:', testEndTime - testStartTime, 'ms');

      // 3. 分析响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('测试API响应错误:', response.status, errorText);
        
        let errorMessage = '';
        
        // 根据状态码判断具体问题
        switch (response.status) {
          case 400:
            errorMessage = '请求格式错误，可能是模型名称不正确';
            break;
          case 401:
            errorMessage = 'API Key认证失败，请检查API Key是否正确';
            break;
          case 403:
            errorMessage = '访问被拒绝，可能是API Key权限不足或已过期';
            break;
          case 404:
            errorMessage = 'API地址不正确，请检查API Base URL';
            break;
          case 429:
            errorMessage = '请求频率过高，请稍后重试';
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorMessage = '服务器内部错误，请稍后重试';
            break;
          default:
            errorMessage = `API请求失败 (${response.status}): ${errorText.slice(0, 100)}`;
        }
        
        setTestResult({
          success: false,
          message: errorMessage
        });
      } else {
        const data = await response.json();
        console.log('测试API响应成功:', data);
        
        // 检查响应中是否包含有效内容
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          setTestResult({
            success: true,
            message: `连接测试成功！模型: ${localSettings.name}, 耗时: ${testEndTime - testStartTime}ms`
          });
        } else {
          setTestResult({
            success: false,
            message: 'API响应格式异常，可能是模型名称不匹配'
          });
        }
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      
      // 分析网络错误
      let errorMessage = '';
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = '网络连接失败，请检查API Base URL是否正确且可访问';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'CORS或网络错误，请检查API Base URL和CORS配置';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = '未知网络错误';
      }
      
      setTestResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave(localSettings);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl w-full">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
          <span className="text-2xl">🤖</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">模型设置</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">模型名称</label>
            <input
              type="text"
              value={localSettings.name}
              onChange={(e) => setLocalSettings({...localSettings, name: e.target.value})}
              placeholder="例如：glm-4.6"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Base</label>
            <input
              type="text"
              value={localSettings.baseUrl}
              onChange={(e) => setLocalSettings({...localSettings, baseUrl: e.target.value})}
              placeholder="例如：https://open.bigmodel.cn/api/paas/v4/"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <input
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
              placeholder="输入您的API密钥"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* 测试结果提示 */}
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {testResult.message}
          </div>
        )}
        
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? '测试中...' : '测试'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// 修改名字输入组件
const RenameInputDialog: React.FC<{
  show: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onCancel: () => void;
}> = ({ show, currentTitle, onConfirm, onCancel }) => {
  const [inputValue, setInputValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setInputValue(currentTitle);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show, currentTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onConfirm(inputValue.trim());
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl w-full">
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">编辑对话名称</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="请输入新的会话名称"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
            maxLength={50}
          />
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChatInterface: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean; conversationId: string; conversationTitle: string}>({
    show: false,
    conversationId: '',
    conversationTitle: ''
  });
  const [renameDialog, setRenameDialog] = useState<{show: boolean; conversationId: string; currentTitle: string}>({
    show: false,
    conversationId: '',
    currentTitle: ''
  });
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [modelSettings, setModelSettings] = useState<{name: string; baseUrl: string; apiKey: string}>({
    name: '',
    baseUrl: '',
    apiKey: ''
  });
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化时加载对话列表和模型设置
  useEffect(() => {
    // 清理可能的旧默认设置
    const oldDefaultKey = 'modelSettings';
    const storedSettings = localStorage.getItem(oldDefaultKey);
    
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        // 如果是旧的默认设置，清除它
        if (parsed.name === '智谱AI' || parsed.baseUrl === 'https://open.bigmodel.cn/api/paas/v4') {
          console.log('清理旧的默认设置');
          localStorage.removeItem(oldDefaultKey);
        }
      } catch (e) {
        // 如果解析失败，也清除
        localStorage.removeItem(oldDefaultKey);
      }
    }
    
    // 加载对话列表
    const storedConversations = localStorage.getItem('conversations');
    if (storedConversations) {
      const parsedConversations: Conversation[] = JSON.parse(storedConversations);
      setConversations(parsedConversations);
    }
    
    // 加载模型设置
    const storedModelSettings = localStorage.getItem('modelSettings');
    console.log('从localStorage加载模型设置:', storedModelSettings);
    
    if (storedModelSettings) {
      try {
        const parsedSettings = JSON.parse(storedModelSettings);
        console.log('解析后的模型设置:', parsedSettings);
        setModelSettings(parsedSettings);
      } catch (error) {
        console.error('解析模型设置失败:', error);
        // 如果解析失败，使用空设置
        const emptySettings = { name: '', baseUrl: '', apiKey: '' };
        setModelSettings(emptySettings);
      }
    } else {
      // 新用户不设置默认值，让用户自己填写
      console.log('未找到保存的模型设置，使用空设置');
      const emptySettings = {
        name: '',
        baseUrl: '',
        apiKey: ''
      };
      setModelSettings(emptySettings);
      // 不保存空设置到localStorage，让用户首次配置时再保存
    }
    
    // 默认进入新建对话状态
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  // 保存对话列表
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // 保存模型设置
  useEffect(() => {
    // 只有当设置不为空时才保存，避免保存空设置覆盖用户输入
    if (modelSettings.name || modelSettings.baseUrl || modelSettings.apiKey) {
      localStorage.setItem('modelSettings', JSON.stringify(modelSettings));
      console.log('模型设置已保存到localStorage:', modelSettings);
    }
  }, [modelSettings]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 创建新对话
  const createNewConversation = () => {
    // 只创建新的空对话状态，不添加到会话列表
    setCurrentConversationId(null); // 设置为null表示当前是新建对话状态
    setMessages([]);
    setInput('');
    setError(null);
  };

  // 更新对话
  const updateConversation = (conversationId: string, newMessages: Message[]) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        const lastUserMessage = newMessages.find(m => m.role === 'user');
        const title = lastUserMessage?.content.slice(0, 15) || '新对话';
        const lastMessage = newMessages[newMessages.length - 1]?.content.slice(0, 30) || '';
        return { ...conv, messages: newMessages, title, lastMessage, timestamp: Date.now() };
      }
      return conv;
    }));
  };

  // 选择对话
  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setMessages(conversation.messages);
    }
    setError(null);
  };

  // 修改对话标题
  const renameConversation = (conversationId: string, newTitle: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, title: newTitle } : conv
    ));
  };

  // 处理AI回答内容，去除多余空行
  const processAIContent = (content: string) => {
    if (!content) return '';
    return content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*\n+|\n+\s*$/g, '')
      .trim();
  };

  // 显示修改对话框
  const showRenameDialog = (conversationId: string, currentTitle: string) => {
    setRenameDialog({
      show: true,
      conversationId,
      currentTitle
    });
  };

  // 确认修改
  const confirmRename = (newTitle: string) => {
    if (newTitle.trim()) {
      renameConversation(renameDialog.conversationId, newTitle.trim());
      setRenameDialog({ show: false, conversationId: '', currentTitle: '' });
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      // 2秒后重置复制状态
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 取消修改
  const cancelRename = () => {
    setRenameDialog({ show: false, conversationId: '', currentTitle: '' });
  };

  // 删除对话
  const deleteConversation = (conversationId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    // 找到要删除的对话
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setDeleteConfirm({
        show: true,
        conversationId,
        conversationTitle: conversation.title
      });
    }
  };

  // 确认删除对话
  const confirmDelete = () => {
    setConversations(prev => prev.filter(conv => conv.id !== deleteConfirm.conversationId));
    
    if (currentConversationId === deleteConfirm.conversationId) {
      // 如果删除的是当前对话，创建一个新对话
      createNewConversation();
    }
    
    // 关闭确认对话框
    setDeleteConfirm({ show: false, conversationId: '', conversationTitle: '' });
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteConfirm({ show: false, conversationId: '', conversationTitle: '' });
  };

  // 按时间分组对话
  const groupConversationsByTime = (convs: Conversation[]) => {
    const now = Date.now();
    const today = now - (now % 86400000);
    const weekAgo = today - (7 * 86400000);

    const todayConvs = convs.filter(conv => conv.timestamp >= today);
    const weekConvs = convs.filter(conv => conv.timestamp >= weekAgo && conv.timestamp < today);
    const olderConvs = convs.filter(conv => conv.timestamp < weekAgo);

    return { todayConvs, weekConvs, olderConvs };
  };

  const { todayConvs, weekConvs, olderConvs } = groupConversationsByTime(conversations);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 检查模型配置
    if (!modelSettings.name || !modelSettings.baseUrl || !modelSettings.apiKey) {
      setError('请先配置模型设置（模型名称、API Base、API Key）');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    // 如果当前没有会话ID（新建对话状态），创建新会话
    let conversationId = currentConversationId;
    if (!conversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.trim().slice(0, 15),
        lastMessage: input.trim().slice(0, 30),
        timestamp: Date.now(),
        messages: []
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      conversationId = newConversation.id;
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      console.log('[' + new Date().toISOString() + '] 开始发送API请求');
      
      const currentMessages = [...messages, userMessage];
      console.log('发送API请求到:', modelSettings.baseUrl);
      console.log('使用模型:', modelSettings.name);
      console.log('消息数量:', currentMessages.length);
      
      const requestStartTime = Date.now();
      // 使用用户配置的API调用
      const response = await fetch(`${modelSettings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${modelSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: modelSettings.name || 'glm-4-flash',
          messages: currentMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: true,
        }),
      });
      
      const requestEndTime = Date.now();
      console.log('[' + new Date().toISOString() + '] API请求完成，耗时:', requestEndTime - requestStartTime, 'ms');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API响应错误:', response.status, errorText);
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }
      
      const streamStartTime = Date.now();
      console.log('[' + new Date().toISOString() + '] 开始读取流数据');
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const readStartTime = Date.now();
        const { done, value } = await reader.read();
        const readEndTime = Date.now();
        
        if (done) {
          console.log('[' + new Date().toISOString() + '] 流数据读取完成，总耗时:', readEndTime - streamStartTime, 'ms');
          break;
        }
        
        if (readEndTime - readStartTime > 1000) {
          console.log('[' + new Date().toISOString() + '] 警告：单次读取耗时:', readEndTime - readStartTime, 'ms');
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                // 同时更新本地messages state和会话数据
                setMessages([...currentMessages, { ...assistantMessage, content: fullResponse }]);
                updateConversation(conversationId, [...currentMessages, { ...assistantMessage, content: fullResponse }]);
                scrollToBottom();
                
                // 记录首次内容时间
                if (fullResponse.length === content.length) {
                  console.log('[' + new Date().toISOString() + '] 首次收到内容，总耗时:', Date.now() - streamStartTime, 'ms');
                }
              }
            } catch (e) {
              console.error('解析流数据错误:', e);
              // 忽略解析错误，继续处理下一行
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setError(error instanceof Error ? error.message : '发送消息失败');
      updateConversation(conversationId, [...messages, userMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* 左侧边栏 */}
      <div className={`${isFullscreen ? 'hidden' : 'w-56'} bg-gray-50 border-r border-gray-100 flex flex-col transition-all duration-300`}>
        {/* Logo区域 */}
        <div className="p-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">AI助手</span>
          </div>
        </div>

        {/* 新建对话按钮 */}
        <div className="px-3 pb-3">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium text-gray-700">新建对话</span>
          </button>
        </div>

        {/* 分隔线 */}
        <div className="px-3 pb-2">
          <div className="border-t border-gray-200"></div>
        </div>

        {/* 会话列表区域 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {todayConvs.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-gray-400">今天</span>
              </div>
              {todayConvs.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 group ${
                    currentConversationId === conv.id ? 'bg-blue-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="text-sm font-medium text-gray-900 truncate"
                      >
                        {conv.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage || '暂无消息'}</p>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showRenameDialog(conv.id, conv.title);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                        title="修改名称"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="删除对话"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {weekConvs.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-gray-400">过去7天</span>
              </div>
              {weekConvs.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 group ${
                    currentConversationId === conv.id ? 'bg-blue-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="text-sm font-medium text-gray-900 truncate"
                      >
                        {conv.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage || '暂无消息'}</p>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showRenameDialog(conv.id, conv.title);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                        title="修改名称"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="删除对话"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {olderConvs.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-gray-400">更早</span>
              </div>
              {olderConvs.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 group ${
                    currentConversationId === conv.id ? 'bg-blue-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="text-sm font-medium text-gray-900 truncate"
                      >
                        {conv.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage || '暂无消息'}</p>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showRenameDialog(conv.id, conv.title);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                        title="修改名称"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="删除对话"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div className="px-3 pb-2">
          <div className="border-t border-gray-200"></div>
        </div>

        {/* 模型设置按钮 - 放在会话列表底部 */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowModelSettings(true)}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="模型设置"
          >
            <span className="text-2xl mr-2">⚙️</span>
            <span className="text-sm font-medium text-gray-700">模型设置</span>
          </button>
        </div>
      </div>

      {/* 右侧聊天区域 */}
      <div className={`flex-1 flex flex-col ${isFullscreen ? 'max-w-4xl mx-auto' : ''} transition-all duration-300`}>
        {/* 头部 - 只在有对话时显示 */}
        {currentConversationId && (
          <div className="relative px-6 py-3 border-b border-gray-100 bg-white">
            {/* 全屏切换按钮 */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={isFullscreen ? "退出全屏" : "全屏模式"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h1 
                  className="text-base font-medium text-gray-900 cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const conversation = conversations.find(c => c.id === currentConversationId);
                    if (conversation) {
                      showRenameDialog(conversation.id, conversation.title);
                    }
                  }}
                >
                  {conversations.find(c => c.id === currentConversationId)?.title || 'AI聊天助手'}
                </h1>
                <p className="text-[10px] text-gray-400 mt-1">内容由AI生成</p>
              </div>
            </div>
          </div>
        )}
        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mt-4">
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-32 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Hi，我是AI助手</h2>
              <p className="text-gray-600 mb-8">请问有什么可以帮您？</p>
              
              {/* 功能选项网格 */}
              <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">写文案</h3>
                    <p className="text-sm text-gray-500">生成营销文案</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">写论文</h3>
                    <p className="text-sm text-gray-500">学术论文助手</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">读论文</h3>
                    <p className="text-sm text-gray-500">解析学术论文</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">翻译</h3>
                    <p className="text-sm text-gray-500">多语言翻译</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* 用户消息 - 右边 */}
                {message.role === 'user' && (
                  <div className="max-w-lg group">
                    <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl">
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      <button
                        onClick={() => copyToClipboard(message.content, `user-${index}`)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-all"
                        title="复制"
                      >
                        {copiedMessageId === `user-${index}` ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* AI消息 - 左边 */}
                {message.role === 'assistant' && (
                  <div className="w-full group">
                    <div className="text-gray-800 text-sm break-words leading-relaxed">
                      <ReactMarkdown
                        components={{
                          // 段落：mb-3 提供适中的阅读间距
                          p: ({children}) => <p className="mb-3 last:mb-0 leading-relaxed text-sm">{children}</p>,
                          
                          // 无序列表：改用 list-outside 配合 ml-6 解决对齐问题
                          ul: ({children}) => <ul className="list-disc list-outside ml-6 mb-4 space-y-2">{children}</ul>,
                          
                          // 有序列表：同理，解决 1. 2. 3. 换行的问题
                          ol: ({children}) => <ol className="list-decimal list-outside ml-6 mb-4 space-y-2">{children}</ol>,
                          
                          li: ({children}) => (
                            <li className="leading-relaxed mb-1 last:mb-0">
                              {/* 技巧：如果 li 内部有 p，强制让 p 变成 inline，
                                 这样即使是松散列表，序号和文字也会在同一行。*/}
                              <div className="[&>p]:inline">{children}</div>
                            </li>
                          ),
                          
                          code({ node, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !className?.includes('language-');
                            const language = match ? match[1] : '';
                            
                            return !isInline && match ? (
                              <div className="relative my-4 group"> {/* 增加上下间距 */}
                                {/* 语言标签：建议放在右侧，避免遮挡代码左侧的缩进 */}
                                <div className="absolute right-3 top-3 text-[10px] font-mono uppercase tracking-wider text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {language}
                                </div>
                                <SyntaxHighlighter
                                  style={tomorrow as any}
                                  language={language}
                                  PreTag="div"
                                  customStyle={{
                                    margin: 0,
                                    padding: '1.25rem', // 增加内边距
                                    borderRadius: '0.75rem',
                                    fontSize: '0.875rem',
                                    lineHeight: '1.5',
                                    backgroundColor: '#f9fafb', // 更浅的背景色
                                  }}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-500 font-mono text-[0.85em]" {...props}>
                                {children}
                              </code>
                            );
                          },
                          // 处理横线问题
                          hr: () => <hr className="my-6 border-gray-100" />,
                        }}
                      >
                        {processAIContent(message.content) || (isLoading && index === messages.length - 1 && message.role === 'assistant' && !message.content ? '正在思考中...' : '')}
                      </ReactMarkdown>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      <button
                        onClick={() => copyToClipboard(message.content, `ai-${index}`)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-all"
                        title="复制"
                      >
                        {copiedMessageId === `ai-${index}` ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-100 bg-white px-32 py-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="给 AI 发送消息..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-sm"
                rows={2}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !currentConversationId}
              className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-400 text-center">
            AI 生成的内容可能不准确，请核实重要信息
          </div>
        </div>
      </div>

      {/* 修改名字对话框 */}
      <RenameInputDialog
        show={renameDialog.show}
        currentTitle={renameDialog.currentTitle}
        onConfirm={confirmRename}
        onCancel={cancelRename}
      />

      {/* 模型设置对话框 */}
      <ModelSettingsDialog
        show={showModelSettings}
        settings={modelSettings}
        onSave={(newSettings) => {
          setModelSettings(newSettings);
          setShowModelSettings(false);
        }}
        onCancel={() => setShowModelSettings(false)}
      />

      {/* 自定义删除确认对话框 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">确定删除对话？</h3>
            <p className="text-gray-600 text-center mb-6">
              删除后，聊天记录将不可恢复。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
