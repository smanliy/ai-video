// 导入 React 核心钩子函数
import { useState, useEffect, useRef, useCallback } from "react";
// 导入服务器配置
import { SERVER_URL } from "../config";
import ReactMarkdown from "react-markdown";
// 导入聊天气泡组件
import ChatBubble from "./ChatBubble";
/**
 * 主内容区域组件 - AI 聊天界面
 */
function MainContent({ uploadedVideo, initialSegments, onJumpToTime, onSummaryGenerated, onMessagesUpdate }) {
  // 状态管理：消息列表
  const [messages, setMessages] = useState([]);
  // 状态管理：当前输入的问题
  const [inputValue, setInputValue] = useState("");
  // 状态管理：加载状态
  const [isLoading, setIsLoading] = useState(false);
  // 状态管理：是否正在进行视频分析（用于区分视频分析和聊天）
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  // 引用：消息容器（用于滚动）
  const messagesContainerRef = useRef(null);
  // 引用：外层容器
  const containerRef = useRef(null);

  /**
   * 格式化时间显示（秒转分:秒）
   */
  const formatTime = (seconds) => {
    const numSeconds = parseFloat(seconds);
    if (isNaN(numSeconds)) return "00:00";
    const mins = Math.floor(numSeconds / 60);
    const secs = Math.floor(numSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * 将分析数据格式化为Markdown文本
   */
  const formatAnalysisResult = (data) => {
    let result = "";
    // 总结
    result += `📝 **总结**：${data.summary || "暂无总结"}\n\n`;
    
    // 分片
    if (data.segments && data.segments.length > 0) {
      data.segments.forEach((segment, index) => {
        const start = formatTime(segment.startTime);
        const end = formatTime(segment.endTime);
        const timeRange = `[${start} - ${end}](timestamp:${segment.startTime})`;
        result += `🎬 **分片${index + 1}**：${segment.title || "未命名"}（${timeRange}）\n\n${segment.description || "暂无描述"}\n\n`;
      });
    }
    
    return result;
  };

  /**
   * 专门分析视频内容
   */
  const analyzeVideo = async () => {
    if (!uploadedVideo?.transcript) return;

    setIsLoading(true);

    try {
      // 调用专门的视频分析流式接口
      const response = await fetch(`${SERVER_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: uploadedVideo.transcript
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      // 创建AI回复消息占位（使用唯一 ID）
      const replyId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: replyId,
        sender: 'assistant',
        content: ""
      }]);

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
      }

      // 尝试解析JSON并格式化
      let formattedContent = fullResponse;
      try {
        // 清理可能存在的代码块标记
        let cleanedResponse = fullResponse
          .replace(/^```json\s*/m, '')
          .replace(/^```\s*/m, '')
          .replace(/\s*```\s*$/m, '')
          .trim();
        
        // 尝试直接解析
        let data = null;
        try {
          data = JSON.parse(cleanedResponse);
        } catch (e1) {
          // 如果直接解析失败，尝试提取 JSON 部分
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              data = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              // 提取失败
            }
          }
        }
        
        // 如果成功解析到数据，并且包含 summary 或 segments，则格式化
        if (data && (data.summary || data.segments)) {
          formattedContent = formatAnalysisResult(data);
          
          // 将总结内容传递给右侧笔记组件
          if (data.summary && onSummaryGenerated) {
            onSummaryGenerated(data.summary);
          }
        }
      } catch (e) {
        // 如果不是JSON，直接使用原始文本
      }

      // 使用打字机效果逐字显示格式化后的内容
      let displayedText = "";
      const chars = formattedContent.split("");
      
      for (let i = 0; i < chars.length; i++) {
        displayedText += chars[i];
        setMessages(prev => prev.map(msg =>
          msg.id === replyId ? { ...msg, content: displayedText } : msg
        ));
        // 控制打字速度，中文字符稍慢
        const delay = chars[i].match(/[\u4e00-\u9fa5]/) ? 30 : 15;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error('分析视频失败:', error);
      // 添加错误消息（使用唯一 ID）
      const errorMsgId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: errorMsgId,
        sender: 'assistant',
        content: `❌ 抱歉，分析失败：${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 发送用户问题给大模型并获取回答（聊天接口）
   */
  const handleSendMessage = async (question = null) => {
    const userQuestion = question || inputValue.trim();
    
    if (!userQuestion) return;

    // 添加用户消息（使用唯一 ID）
    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userMessage = {
      id: userMessageId,
      sender: 'user',
      content: userQuestion
    };
    
    // 创建新的消息列表（包含用户消息）
    const newMessages = [...messages, userMessage];
    console.log('[MainContent] 添加用户消息:', userMessage);
    console.log('[MainContent] 新消息列表:', newMessages);
    setMessages(newMessages);
    
    if (!question) {
      setInputValue("");
    }
    setIsLoading(true);

    try {
      // 调用后端聊天 API
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          transcript: uploadedVideo?.transcript || '',
          messages: newMessages.map(msg => ({
            role: msg.sender === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      // 创建AI回复消息占位（使用唯一 ID）
      const replyId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: replyId,
        sender: 'assistant',
        content: ""
      }]);

      // 处理流式响应 - 边接收边显示
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = "";
      let buffer = new Uint8Array(0);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 处理最后剩余的数据
          if (buffer.length > 0) {
            accumulatedContent += decoder.decode(buffer, { stream: false });
            setMessages(prev => prev.map(msg =>
              msg.id === replyId ? { ...msg, content: accumulatedContent } : msg
            ));
          }
          break;
        }
        
        // 将新数据添加到缓冲区
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer, 0);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
        
        // 尝试解码完整字符
        try {
          const chunk = decoder.decode(buffer, { stream: true });
          if (chunk.length > 0) {
            accumulatedContent += chunk;
            // 立即更新UI，实现真正的流式输出
            setMessages(prev => prev.map(msg =>
              msg.id === replyId ? { ...msg, content: accumulatedContent } : msg
            ));
            // 清空已解码的部分
            buffer = new Uint8Array(0);
          }
        } catch (e) {
          // 字符不完整，继续等待更多数据
        }
        
        // 添加微小延迟，避免UI更新过快
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } catch (error) {
      console.error('发送消息失败:', error);
      // 添加错误消息（使用唯一 ID）
      const errorMsgId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: errorMsgId,
        sender: 'assistant',
        content: `❌ 抱歉，请求失败：${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理回车键发送
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * 自动滚动到底部
   */
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  /**
   * 消息更新时通知父组件
   */
  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  /**
   * 页面加载后显示欢迎消息
   */
  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      // 添加欢迎消息
      const welcomeMsgId = `welcome_${Date.now()}`;
      setMessages([{
        id: welcomeMsgId,
        sender: 'assistant',
        content: '你好！我是你的 AI 视频分析助手。请先上传视频，我会自动为您分析内容。'
      }]);
    }
  }, [messages.length, isLoading]);

  /**
   * 视频上传后自动分析
   */
  useEffect(() => {
    if (uploadedVideo && !isLoading) {
      // 设置加载状态
      setIsLoading(true);
      // 设置视频分析状态
      setIsAnalyzingVideo(true);
      
      // 清空之前的消息
      setMessages([]);
      
      // 添加分析提示消息
      const analyzingMsgId = `analyzing_${Date.now()}`;
      setMessages([{
        id: analyzingMsgId,
        sender: 'assistant',
        content: `🎬 正在分析视频：${uploadedVideo.filename}...`
      }]);
    }
  }, [uploadedVideo]);

  // 当 initialSegments 到达时，直接显示结果（替换正在分析的消息）
  useEffect(() => {
    if (initialSegments && isLoading && isAnalyzingVideo) {
      const formattedResult = formatAnalysisResult(initialSegments);
      setMessages([{
        id: `result_${Date.now()}`,
        sender: 'assistant',
        content: `🎬 视频分析完成：${uploadedVideo?.filename}\n\n${formattedResult}`
      }]);
      setIsLoading(false);
      setIsAnalyzingVideo(false);
    }
  }, [initialSegments, isLoading, isAnalyzingVideo]);

  return (
    // 外层容器：使用 flex 布局，确保输入框固定在底部
    <div
      ref={containerRef}
      className="main-content"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
        overflow: 'hidden'
      }}
    >
      {/* 头部 - 固定高度 */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '14px' }}>🤖</span>
            </div>
            <span style={{ fontWeight: '500', color: '#1f2937', fontSize: '14px' }}>AI 视频分析</span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            {uploadedVideo ? `已上传: ${uploadedVideo.filename}` : '请上传视频开始分析'}
          </div>
        </div>
      </header>

      {/* 消息列表区域 - 占据剩余空间，独立滚动 */}
      <div
        ref={messagesContainerRef}
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '16px',
          minHeight: '0'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* 渲染所有消息 */}
          {messages.length > 0 && messages.map(message => (
            <ChatBubble
              key={message.id}
              content={message.content}
              sender={message.sender}
              isLoading={isLoading && message.sender === 'assistant' && message.id === messages[messages.length - 1]?.id}
              onJumpToTime={onJumpToTime}
            />
          ))}

          {/* 模式提示 */}
          {!isLoading && messages.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
              当前模式：视频上传后自动分析
            </div>
          )}
        </div>
      </div>

      {/* 输入框区域 - 固定在中间组件可视区域最底部 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '12px 16px',
        flexShrink: 0,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            backgroundColor: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            padding: '8px'
          }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题，按 Enter 发送..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                backgroundColor: 'transparent',
                padding: '12px 16px',
                fontSize: '14px',
                lineHeight: '1.5',
                color: '#374151',
                minHeight: '40px',
                maxHeight: '120px'
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: inputValue.trim() && !isLoading ? '#0ea5e9' : '#cbd5e1',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? (
                <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainContent;