// 服务器地址配置
// 开发环境使用 localhost，生产环境使用相对路径
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000')
