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
      marginBottom: '20px',
      gap: '12px'
    }}>
      {/* AI助手头像 - 在气泡外面，左边 */}
      {isAssistant && (
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(14, 165, 233, 0.4)',
          marginTop: '4px'
        }}>
          <span style={{ color: 'white', fontSize: '18px' }}>🤖</span>
        </div>
      )}

      {/* AI助手气泡 */}
      {isAssistant && (
        <div style={{
          maxWidth: 'calc(85% - 52px)',
          backgroundColor: '#e0f2fe',
          border: '2px solid #7dd3fc',
          borderRadius: '20px',
          borderTopLeftRadius: '6px',
          boxShadow: '0 4px 16px rgba(14, 165, 233, 0.2)',
          padding: '16px 20px',
          position: 'relative'
        }}>
          {/* 气泡尾巴 */}
          <div style={{
            position: 'absolute',
            left: '-10px',
            top: '12px',
            width: '0',
            height: '0',
            borderTop: '10px solid transparent',
            borderRight: '10px solid #7dd3fc',
            borderBottom: '10px solid transparent',
          }} />
          <div style={{
            position: 'absolute',
            left: '-8px',
            top: '12px',
            width: '0',
            height: '0',
            borderTop: '9px solid transparent',
            borderRight: '9px solid #e0f2fe',
            borderBottom: '9px solid transparent',
          }} />

          <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
            <ReactMarkdown>{content || '等待回复...'}</ReactMarkdown>
          </div>

          {isLoading && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '4px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '6px', 
                height: '6px', 
                backgroundColor: '#0ea5e9',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both'
              }} />
              <span style={{ 
                display: 'inline-block', 
                width: '6px', 
                height: '6px', 
                backgroundColor: '#0ea5e9',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0.2s'
              }} />
              <span style={{ 
                display: 'inline-block', 
                width: '6px', 
                height: '6px', 
                backgroundColor: '#0ea5e9',
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
            maxWidth: 'calc(85% - 52px)',
            backgroundColor: '#fce7f3',
            border: '2px solid #fbcfe8',
            borderRadius: '20px',
            borderTopRightRadius: '6px',
            boxShadow: '0 4px 16px rgba(236, 72, 153, 0.15)',
            padding: '16px 20px',
            position: 'relative'
          }}>
            {/* 气泡尾巴 */}
            <div style={{
              position: 'absolute',
              right: '-10px',
              top: '12px',
              width: '0',
              height: '0',
              borderTop: '10px solid transparent',
              borderLeft: '10px solid #fbcfe8',
              borderBottom: '10px solid transparent',
            }} />
            <div style={{
              position: 'absolute',
              right: '-8px',
              top: '12px',
              width: '0',
              height: '0',
              borderTop: '9px solid transparent',
              borderLeft: '9px solid #fce7f3',
              borderBottom: '9px solid transparent',
            }} />

            <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#4c1d4c', whiteSpace: 'pre-wrap' }}>
              {content || '等待回复...'}
            </div>
          </div>

          {/* 用户头像 - 在气泡外面，右边 */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(236, 72, 153, 0.4)',
            marginTop: '4px'
          }}>
            <span style={{ color: 'white', fontSize: '18px' }}>👤</span>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatBubble
