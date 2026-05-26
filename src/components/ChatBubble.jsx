// 导入 React
import React from 'react'
// 导入 Markdown 渲染组件
import ReactMarkdown from 'react-markdown'

function ChatBubble({ content, sender = 'assistant', isLoading = false }) {
  const isAssistant = sender === 'assistant'

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: isAssistant ? 'flex-start' : 'flex-end',
      marginBottom: '16px',
      gap: '8px'
    }}>
      {/* AI助手头像 - 在气泡外面，左边 */}
      {isAssistant && (
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '4px'
        }}>
          <span style={{ color: 'white', fontSize: '16px' }}>🤖</span>
        </div>
      )}

      {/* AI助手气泡 */}
      {isAssistant && (
        <div style={{
          maxWidth: '75%',
          backgroundColor: '#5b8dd9',
          borderRadius: '18px',
          borderTopLeftRadius: '6px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          padding: '12px 16px',
          position: 'relative'
        }}>
          <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#ffffff', whiteSpace: 'pre-wrap' }}>
            <ReactMarkdown>{content || '等待回复...'}</ReactMarkdown>
          </div>

          {isLoading && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '3px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '5px', 
                height: '5px', 
                backgroundColor: '#999999',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both'
              }} />
              <span style={{ 
                display: 'inline-block', 
                width: '5px', 
                height: '5px', 
                backgroundColor: '#999999',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0.2s'
              }} />
              <span style={{ 
                display: 'inline-block', 
                width: '5px', 
                height: '5px', 
                backgroundColor: '#999999',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0.4s'
              }} />
            </div>
          )}
        </div>
      )}

      {/* 用户气泡 */}
      {!isAssistant && (
        <>
          <div style={{
            maxWidth: '75%',
            backgroundColor: '#f87171',
            borderRadius: '18px',
            borderTopRightRadius: '6px',
            padding: '12px 16px',
            position: 'relative'
          }}>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#ffffff', whiteSpace: 'pre-wrap' }}>
              {content || '等待回复...'}
            </div>
          </div>

          {/* 用户头像 - 在气泡外面，右边 */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '4px'
          }}>
            <span style={{ color: 'white', fontSize: '16px' }}>👤</span>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatBubble
