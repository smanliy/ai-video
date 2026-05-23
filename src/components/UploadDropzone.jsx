function UploadDropzone({ isDragging, onDragOver, onDragLeave, onDrop, onFileSelect }) {
  return (
    <div
      className={`upload-area ${isDragging ? 'dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept="video/*"
        onChange={onFileSelect}
        className="file-input"
      />
      <div className="upload-content">
        <svg
          className="upload-icon"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="upload-text">拖拽视频文件到此处</p>
        <p className="upload-hint">或点击选择文件</p>
        <p className="upload-format">支持 MP4, MOV, AVI, WebM 等格式</p>
      </div>
    </div>
  )
}

export default UploadDropzone
