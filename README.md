# 交互日志工具 (Interaction Logger Tool)

🦐 自动同步 OpenClaw 会话历史到交互日志平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D14-green.svg)](https://nodejs.org/)

---

## 🌟 功能特性

- ✅ **自动同步** - 定时从 OpenClaw 会话历史中提取消息
- ✅ **智能配对** - 自动配对 user-assistant 对话
- ✅ **多通道支持** - 飞书、QQ、钉钉、企微等所有通道
- ✅ **零侵入** - 无需修改 OpenClaw 核心代码
- ✅ **断点续传** - 记录同步进度，避免重复
- ✅ **异步发送** - 不阻塞主程序，失败自动重试

---

## 🚀 快速开始

### 一键安装（推荐）

```bash
# 下载安装脚本并执行
wget -qO- https://raw.githubusercontent.com/is-spectator/interaction-logger-tool/main/install.sh | bash
```

### 手动安装

```bash
# 1. 克隆或下载仓库
git clone https://github.com/is-spectator/interaction-logger-tool.git
cd interaction-logger-tool

# 2. 复制配置文件
cp config.example.json config.json

# 3. 编辑配置
vim config.json

# 4. 测试运行
node sync-interaction-log.js

# 5. 添加定时任务（每分钟同步一次）
(crontab -l 2>/dev/null; echo "*/1 * * * * cd $(pwd) && node sync-interaction-log.js >> sync.log 2>&1") | crontab -
```

---

## 📝 配置说明

**🎉 开箱即用！** 默认配置已指向统一日志平台，安装后自动同步！

如需修改，编辑 `config.json`：

```json
{
  "api_base": "http://47.90.246.218:8505",    // 统一日志平台地址
  "bot_token": "token_xiaoxia_001",           // Bot Token（联系平台管理员获取）
  "bot_name": "小虾虾",                        // Bot 名称
  "platform": "openclaw",                     // 平台标识
  "sessions_dir": "/home/admin/.openclaw/agents/main/sessions",  // OpenClaw 会话目录
  "state_file": "./.sync-state.json",         // 状态文件路径
  "sync_interval": 60000,                     // 守护进程模式下的同步间隔（毫秒）
  "max_messages_per_run": 100                 // 每次最多同步的消息数
}
```

**📊 统一日志平台：**
- 所有机器人的交互记录集中管理
- 访问地址：http://47.90.246.218:8505
- 支持多 Bot、多用户、多渠道

**🔑 Bot Token 配置：**
如需添加新的 Bot，联系平台管理员在 `config/tokens.json` 中添加：
```json
{
  "token_your_bot_001": {
    "robot_key": "your-bot-id",
    "name": "你的机器人名称",
    "platform": "openclaw"
  }
}
```

---

## 💡 使用方式

### 手动运行

```bash
# 运行一次同步
node sync-interaction-log.js

# 调试模式（查看详细日志）
node sync-interaction-log.js --debug

# 守护进程模式（持续运行）
node sync-interaction-log.js --daemon
```

### 定时任务

```bash
# 查看当前定时任务
crontab -l

# 编辑定时任务
crontab -e

# 示例：每 5 分钟同步一次
*/5 * * * * cd /path/to/interaction-logger-tool && node sync-interaction-log.js >> sync.log 2>&1
```

### 查看日志

```bash
# 查看同步日志
tail -f sync.log

# 查看最近的同步记录
tail -n 50 sync.log
```

---

## 📊 交互日志平台

本项目需要配合交互日志平台使用：

**交互日志平台仓库**: https://github.com/is-spectator/interaction-log-platform

### 平台部署

```bash
# 克隆平台仓库
git clone https://github.com/is-spectator/interaction-log-platform.git
cd interaction-log-platform

# Docker 部署
docker compose up -d

# 访问 Web 管理台
# http://localhost:8505
```

### 配置 Bot Token

在平台的 `config/tokens.json` 中添加你的 Bot：

```json
{
  "token_xiaoxia_001": {
    "robot_key": "agent:main",
    "name": "小虾虾",
    "platform": "openclaw"
  }
}
```

---

## 🔧 高级配置

### 同步频率调整

```bash
# 编辑 crontab
crontab -e

# 每 10 分钟同步一次
*/10 * * * * cd /path/to/tool && node sync-interaction-log.js

# 每小时同步一次
0 * * * * cd /path/to/tool && node sync-interaction-log.js

# 每天凌晨 2 点同步一次
0 2 * * * cd /path/to/tool && node sync-interaction-log.js
```

### 多实例支持

如果有多个 OpenClaw 实例，可以运行多个同步进程：

```bash
# 实例 1
cd /path/to/instance1 && node sync-interaction-log.js

# 实例 2
cd /path/to/instance2 && node sync-interaction-log.js
```

每个实例使用不同的 `state_file` 和 `bot_token` 即可。

---

## 📁 文件结构

```
interaction-logger-tool/
├── sync-interaction-log.js    # 主程序
├── config.json                # 配置文件（运行时）
├── config.example.json        # 配置示例
├── install.sh                 # 安装脚本
├── README.md                  # 说明文档
├── .sync-state.json           # 同步状态（自动生成）
└── sync.log                   # 运行日志（定时任务输出）
```

---

## 🐛 故障排查

### 问题 1：没有同步到任何消息

**检查点：**
1. 确认 `sessions_dir` 路径正确
2. 确认会话目录中有 `.jsonl` 文件
3. 使用 `--debug` 模式查看详细日志

```bash
node sync-interaction-log.js --debug
```

### 问题 2：日志平台连接失败

**检查点：**
1. 确认 `api_base` 地址正确
2. 确认日志平台正在运行
3. 确认 `bot_token` 与平台配置一致

```bash
# 测试 API 连接
curl -X GET http://localhost:8505/health
```

### 问题 3：重复同步消息

**解决方案：**
删除状态文件，重新同步：

```bash
rm .sync-state.json
node sync-interaction-log.js
```

---

## 📖 相关项目

- **交互日志平台**: https://github.com/is-spectator/interaction-log-platform
- **OpenClaw**: https://github.com/openclaw/openclaw
- **ClawDBot**: https://github.com/clawdbot/clawdbot

---

## 📄 License

MIT License

---

## 🦐 关于小虾虾

这个工具是由 **小虾虾** 🦐 开发的，用于帮助方脑壳和其他用户自动记录机器人交互日志。

如果你有任何问题或建议，欢迎提 Issue 或 PR！
