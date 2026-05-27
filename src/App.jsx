import { useState, useCallback } from 'react'
import SidebarLeft from './components/sidebar-left/SidebarLeft'
import MainContent from './components/MainContent'
import SidebarRight from './components/sidebar-right/SidebarRight'
import './App.css'

/**
 * 主应用组件
 * 管理全局状态并协调各子组件
 */
function App() {
  const [uploadedVideo, setUploadedVideo] = useState(null)
  const [segments, setSegments] = useState(null)
  const [jumpToTime, setJumpToTime] = useState(null)
  const [notes, setNotes] = useState('')
  const [conversationSummary, setConversationSummary] = useState('')
  const [messages, setMessages] = useState([])
  const [showNotes, setShowNotes] = useState(false)

  const handleVideoUpload = useCallback((videoData) => {
    setUploadedVideo(videoData)
    setSegments(null) // 重置segments
  }, [])

  const handleVideoRemove = useCallback(() => {
    setUploadedVideo(null)
    setSegments(null)
  }, [])

  const handleSegmentsGenerated = useCallback((newSegments) => {
    setSegments(newSegments)
  }, [])

  const handleJumpToTime = useCallback((timeInSeconds) => {
    setJumpToTime(timeInSeconds)
  }, [])

  const handleNotesChange = useCallback((newNotes) => {
    setNotes(newNotes)
  }, [])

  const handleSummaryGenerated = useCallback((summary) => {
    setConversationSummary(summary)
  }, [])

  const handleMessagesUpdate = useCallback((newMessages) => {
    setMessages(newMessages)
  }, [])

  const handleToggleNotes = useCallback(() => {
    setShowNotes(prev => !prev)
  }, [])

  return (
    <div className="app-container">
      {/* 左侧边栏 - 视频上传和控制 */}
      <SidebarLeft
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
        onSegmentsGenerated={handleSegmentsGenerated}
        jumpToTime={jumpToTime}
        onJumpToTime={handleJumpToTime}
      />

      {/* 中间主内容区 - AI聊天界面 */}
      <MainContent 
        uploadedVideo={uploadedVideo} 
        initialSegments={segments}
        onJumpToTime={handleJumpToTime}
        onSummaryGenerated={handleSummaryGenerated}
        onMessagesUpdate={handleMessagesUpdate}
        showNotes={showNotes}
        onToggleNotes={handleToggleNotes}
      />

      {/* 右侧边栏 - 笔记和导出（根据 showNotes 状态显示/隐藏） */}
      {showNotes && (
        <SidebarRight 
          notes={notes}
          onNotesChange={handleNotesChange}
          conversationSummary={conversationSummary}
          messages={messages}
        />
      )}
    </div>
  )
}

export default App