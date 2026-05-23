import { useState, useEffect, useRef, useCallback } from "react";
import { SERVER_URL } from "../config";
import ReactMarkdown from "react-markdown";
import ChatBubble from "./ChatBubble";

function MainContent({ uploadedVideo, chapters }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef(null);
  const containerRef = useRef(null);

  const formatTime = (seconds) => {
    const numSeconds = parseFloat(seconds);
    if (isNaN(numSeconds)) return "00:00";
    const mins = Math.floor(numSeconds / 60);
    const secs = Math.floor(numSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatAnalysisResult = (data) => {
    let result = "";
    result += `📝 **总结**：${data.summary || "暂无总结"}\n\n`;
    
    if (data.segments && data.segments.length > 0) {
      data.segments.forEach(({ title, startTime, endTime, description }, index) => {
        const start = formatTime(startTime);
        const end = formatTime(endTime);
        const timeRange = `${start} - ${end}`;
        result += `🎬 **分片${index + 1}**：${title || ""}（${timeRange}）\n\n${description || "暂无描述"}\n\n`;
      });
    }
    
    return result;
  };

  const analyzeVideo = async () => {
    if (!uploadedVideo?.transcript) return;

    setIsLoading(true);

    try {
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

      const replyId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: replyId,
        sender: 'assistant',
        content: ""
      }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
      }

      let formattedContent = fullResponse;
      try {
        let cleanedResponse = fullResponse
          .replace(/^```json\s*/m, '')
          .replace(/^```\s*/m, '')
          .replace(/\s*```\s*$/m, '')
          .trim();
        
        let data = null;
        try {
          data = JSON.parse(cleanedResponse);
        } catch (e1) {
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              data = JSON.parse(jsonMatch[0]);
            } catch (e2) {
            }
          }
        }
        
        if (data && (data.summary || data.segments)) {
          formattedContent = formatAnalysisResult(data);
        }
      } catch (e) {
      }

      let displayedText = "";
      const chars = formattedContent.split("");
      
      for (let i = 0; i < chars.length; i++) {
        displayedText += chars[i];
        setMessages(prev => prev.map(msg =>
          msg.id === replyId ? { ...msg, content: displayedText } : msg
        ));
        const delay = chars[i].match(/[\u4e00-\u9fa5]/) ? 30 : 15;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error('分析视频失败:', error);
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

  const handleSendMessage = async (question = null) => {
    const userQuestion = question || inputValue.trim();
    
    if (!userQuestion) return;

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userMessage = {
      id: userMessageId,
      sender: 'user',
      content: userQuestion
    };
    setMessages(prev => [...prev, userMessage]);
    
    if (!question) {
      setInputValue("");
    }
    setIsLoading(true);

    try {
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          transcript: uploadedVideo?.transcript || '',
          messages: messages.map(msg => ({
            role: msg.sender === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const replyId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: replyId,
        sender: 'assistant',
        content: ""
      }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
      }

      let formattedContent = fullResponse;
      try {
        let cleanedResponse = fullResponse
          .replace(/^```json\s*/m, '')
          .replace(/^```\s*/m, '')
          .replace(/\s*```\s*$/m, '')
          .trim();
        
        let data = null;
        try {
          data = JSON.parse(cleanedResponse);
        } catch (e1) {
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              data = JSON.parse(jsonMatch[0]);
            } catch (e2) {
            }
          }
        }
        
        if (data && (data.summary || data.segments)) {
          formattedContent = formatAnalysisResult(data);
        }
      } catch (e) {
      }

      let displayedText = "";
      const chars = formattedContent.split("");
      
      for (let i = 0; i < chars.length; i++) {
        displayedText += chars[i];
        setMessages(prev => prev.map(msg =>
          msg.id === replyId ? { ...msg, content: displayedText } : msg
        ));
        const delay = chars[i].match(/[\u4e00-\u9fa5]/) ? 30 : 15;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error('发送消息失败:', error);
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      const welcomeMsgId = `welcome_${Date.now()}`;
      setMessages([{
        id: welcomeMsgId,
        sender: 'assistant',
        content: '你好！我是你的 AI 视频分析助手。请先上传视频，我会自动为您分析内容。'
      }]);
    }
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (uploadedVideo && !isLoading) {
      setMessages([]);
      
      const analyzingMsgId = `analyzing_${Date.now()}`;
      setMessages([{
        id: analyzingMsgId,
        sender: 'assistant',
        content: `🎬 正在分析视频：${uploadedVideo.filename}...`
      }]);

      setTimeout(() => {
        analyzeVideo();
      }, 1000);
    }
  }, [uploadedVideo]);

  useEffect(() => {
    if (chapters && chapters.length > 0 && uploadedVideo) {
      const existingMsgIndex = messages.findIndex(msg => msg.content.includes('🎬 **分片'));
      
      if (existingMsgIndex === -1) {
        const chapterMsgId = `chapter_${Date.now()}`;
        const chapterData = {
          summary: '视频章节分析完成',
          segments: chapters
        };
        const formattedContent = formatAnalysisResult(chapterData);
        
        let displayedText = "";
        const chars = formattedContent.split("");
        
        setMessages(prev => [...prev, {
          id: chapterMsgId,
          sender: 'assistant',
          content: ""
        }]);
        
        const typeText = async () => {
          for (let i = 0; i < chars.length; i++) {
            displayedText += chars[i];
            setMessages(prev => prev.map(msg =>
              msg.id === chapterMsgId ? { ...msg, content: displayedText } : msg
            ));
            const delay = chars[i].match(/[\u4e00-\u9fa5]/) ? 30 : 15;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        };
        
        setTimeout(typeText, 500);
      }
    }
  }, [chapters, uploadedVideo, messages]);

  return (
    <main className="main-content">
      <div className="panel">
        <h2>视频分析</h2>
        <div className="content-card">
          <h3>AI 分析结果</h3>
          <p>这是AI对视频内容的分析摘要。系统会自动识别视频中的关键信息、人物、场景等，并生成结构化的分析报告。</p>
          <p>您可以在这里查看完整的视频转录文本、时间轴标记以及AI生成的内容摘要。</p>
        </div>
      </div>
    </div>
  );
}

export default MainContent;
