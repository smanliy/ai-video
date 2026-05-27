import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { SERVER_URL } from '../../config'

/**
 * 右侧笔记组件
 * - 支持 Markdown 编辑和预览
 * - 支持从对话内容自动总结
 * - 支持加粗、斜体、标题等 Markdown 语法
 */
function SidebarRight({ notes, onNotesChange, conversationSummary, messages }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes || '')
  const [isSummarizing, setIsSummarizing] = useState(false)

  // 当外部笔记更新时同步
  useEffect(() => {
    if (notes !== undefined && notes !== localNotes) {
      setLocalNotes(notes)
    }
  }, [notes])

  // 当对话总结更新时自动添加到笔记
  useEffect(() => {
    if (conversationSummary && conversationSummary.trim()) {
      const newContent = `## 📝 对话总结\n\n${conversationSummary}\n\n---\n\n${localNotes}`
      setLocalNotes(newContent)
      if (onNotesChange) {
        onNotesChange(newContent)
      }
    }
  }, [conversationSummary])

  const handleChange = (e) => {
    const value = e.target.value
    setLocalNotes(value)
    if (onNotesChange) {
      onNotesChange(value)
    }
  }

  // 插入 Markdown 格式
  const insertFormat = (prefix, suffix = '') => {
    const textarea = document.querySelector('.notes-textarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = localNotes.substring(start, end)
    
    const newText = localNotes.substring(0, start) + prefix + selectedText + suffix + localNotes.substring(end)
    setLocalNotes(newText)
    if (onNotesChange) {
      onNotesChange(newText)
    }

    // 聚焦并设置光标位置
    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length)
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length)
      }
    }, 0)
  }

  // 插入标题
  const insertHeading = (level) => {
    const prefix = '#'.repeat(level) + ' '
    insertFormat(prefix, '\n')
  }

  const handleExport = () => {
    const blob = new Blob([localNotes], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes_${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    if (window.confirm('确定要清空笔记吗？')) {
      setLocalNotes('')
      if (onNotesChange) {
        onNotesChange('')
      }
    }
  }

  // 调用 AI 总结对话内容（流式输出）
  const handleSummarize = async () => {
    if (!messages || messages.length === 0) {
      alert('暂无对话内容可总结')
      return
    }

    setIsSummarizing(true)

    try {
      const response = await fetch(`${SERVER_URL}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.sender === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      // 处理流式响应
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let accumulatedSummary = ''
      const timestamp = new Date().toLocaleString('zh-CN')
      const prefix = `## 📝 对话总结 (${timestamp})\n\n`
      const suffix = '\n\n---\n\n'

      // 先添加标题
      setLocalNotes(prefix + accumulatedSummary + suffix + localNotes)
      if (onNotesChange) {
        onNotesChange(prefix + accumulatedSummary + suffix + localNotes)
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        // 累加内容
        accumulatedSummary += decoder.decode(value, { stream: true })
        
        // 实时更新笔记
        setLocalNotes(prefix + accumulatedSummary + suffix + localNotes)
        if (onNotesChange) {
          onNotesChange(prefix + accumulatedSummary + suffix + localNotes)
        }
      }

      // 处理最后剩余的数据
      accumulatedSummary += decoder.decode(new Uint8Array(), { stream: false })
      
      if (accumulatedSummary.trim()) {
        setLocalNotes(prefix + accumulatedSummary + suffix + localNotes)
        if (onNotesChange) {
          onNotesChange(prefix + accumulatedSummary + suffix + localNotes)
        }
      }
    } catch (error) {
      console.error('总结失败:', error)
      alert('总结失败：' + error.message)
    } finally {
      setIsSummarizing(false)
    }
  }

  return (
    <aside className="sidebar-right">
      <div className="panel">
        <div className="panel-header">
          <h2>📝 笔记</h2>
          <div className="panel-actions">
            <button
              className={`btn btn-sm ${isEditing ? 'btn-active' : ''}`}
              onClick={() => setIsEditing(true)}
            >
              ✏️ 编辑
            </button>
            <button
              className={`btn btn-sm ${!isEditing ? 'btn-active' : ''}`}
              onClick={() => setIsEditing(false)}
            >
              👁️ 预览
            </button>
          </div>
        </div>

        <div className="notes-content">
          {isEditing ? (
            <div className="editor-container">
              {/* 工具栏 */}
              <div className="toolbar">
                <button className="toolbar-btn" onClick={() => insertHeading(1)} title="标题1">
                  <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>H1</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertHeading(2)} title="标题2">
                  <span style={{fontSize: '1.25rem', fontWeight: 'bold'}}>H2</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertHeading(3)} title="标题3">
                  <span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>H3</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertHeading(4)} title="标题4">
                  <span style={{fontSize: '1rem', fontWeight: 'bold'}}>H4</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertHeading(5)} title="标题5">
                  <span style={{fontSize: '0.9rem', fontWeight: 'bold', color: '#9ca3af'}}>H5</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertHeading(6)} title="标题6">
                  <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280'}}>H6</span>
                </button>
                <div className="toolbar-divider"></div>
                <button className="toolbar-btn" onClick={() => insertFormat('**', '**')} title="加粗">
                  <span style={{fontWeight: 'bold'}}>B</span>
                </button>
                <button className="toolbar-btn" onClick={() => insertFormat('*', '*')} title="斜体">
                  <span style={{fontStyle: 'italic'}}>I</span>
                </button>
                <div className="toolbar-divider"></div>
                <button className="toolbar-btn" onClick={() => insertFormat('```\n', '\n```')} title="代码块">
                  <span style={{fontFamily: 'monospace', fontSize: '0.875rem'}}>&lt;/&gt;</span>
                </button>
              </div>
              <textarea
                value={localNotes}
                onChange={handleChange}
                placeholder="在此输入笔记，支持 Markdown 语法..."
                className="notes-textarea"
              />
            </div>
          ) : (
            <div className="notes-preview markdown-body light-preview">
              {localNotes.trim() ? (
                <ReactMarkdown remarkPlugins={[]} components={{
                  h1: ({ children }) => <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#000000', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #333', letterSpacing: '-0.02em' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#000000', marginBottom: '0.8rem', marginTop: '1.2rem' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1a1a1a', marginBottom: '0.6rem', marginTop: '1rem' }}>{children}</h3>,
                  h4: ({ children }) => <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a', marginBottom: '0.5rem', marginTop: '0.8rem' }}>{children}</h4>,
                  h5: ({ children }) => <h5 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#333333', marginBottom: '0.4rem', marginTop: '0.6rem' }}>{children}</h5>,
                  h6: ({ children }) => <h6 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#333333', marginBottom: '0.4rem', marginTop: '0.5rem' }}>{children}</h6>,
                  strong: ({ children }) => <strong style={{ fontWeight: '900', color: '#000000', letterSpacing: '0.01em' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: 'italic', color: '#333333' }}>{children}</em>,
                  p: ({ children }) => <p style={{ color: '#000000', lineHeight: '1.75', marginBottom: '0.75rem', marginTop: '0.25rem', fontWeight: '400' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ color: '#000000', paddingLeft: '1.75rem', marginBottom: '0.75rem', marginTop: '0.25rem', listStyleType: 'disc' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ color: '#000000', paddingLeft: '1.75rem', marginBottom: '0.75rem', marginTop: '0.25rem', listStyleType: 'decimal' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: '0.35rem', paddingLeft: '0.25rem', fontWeight: '400' }}>{children}</li>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #666', paddingLeft: '1rem', color: '#444', marginBottom: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic', background: '#f5f5f5', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: '0 8px 8px 0' }}>{children}</blockquote>,
                  code: ({ className, children }) => {
                    const isBlock = className && className.includes('language-');
                    if (isBlock) {
                      return <pre style={{ 
                        background: '#1a1a1a', 
                        padding: '1.25rem', 
                        borderRadius: '10px', 
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace', 
                        fontSize: '0.825rem', 
                        overflowX: 'auto', 
                        marginBottom: '0.75rem',
                        marginTop: '0.5rem',
                        lineHeight: '1.6'
                      }}><code style={{ color: '#e06c75' }}>{children}</code></pre>;
                    }
                    return <code style={{ 
                      background: '#f0f0f0', 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: '6px', 
                      color: '#333', 
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace', 
                      fontSize: '0.825rem',
                      fontWeight: '600'
                    }}>{children}</code>;
                  },
                  pre: ({ children }) => <div style={{ marginBottom: '0.75rem' }}>{children}</div>,
                  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1.5rem 0' }} />,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline', fontWeight: '500' }}>{children}</a>,
                }}>
                  {localNotes}
                </ReactMarkdown>
              ) : (
                <div className="empty-state">
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    暂无笔记内容
                  </p>
                  <p style={{ color: '#4b5563', textAlign: 'center', fontSize: '0.875rem' }}>
                    点击「编辑」按钮开始记录
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="divider"></div>

        <div className="notes-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleSummarize}
            disabled={isSummarizing}
          >
            {isSummarizing ? '🔄 总结中...' : '🤖 AI总结'}
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            📤 导出笔记
          </button>
          <button className="btn btn-secondary" onClick={handleClear}>
            🗑️ 清空
          </button>
        </div>

      </div>
    </aside>
  )
}

export default SidebarRight
