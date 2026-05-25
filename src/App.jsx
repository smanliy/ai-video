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

  const handleVideoUpload = useCallback((videoData) => {
    setUploadedVideo(videoData)
  }, [])

  const handleVideoRemove = useCallback(() => {
    setUploadedVideo(null)
  }, [])

  return (
    <div className="app-container">
      {/* 左侧边栏 - 视频上传和控制 */}
      <SidebarLeft
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
      />

      {/* 中间主内容区 - AI聊天界面 */}
      <MainContent uploadedVideo={uploadedVideo} />

      {/* 右侧边栏 - 笔记和导出 */}
      <SidebarRight />
    </div>
  )
}

export default App