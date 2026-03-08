#!/bin/bash
# 交互日志工具 - 一键安装脚本
# 使用方式：wget -qO- https://raw.githubusercontent.com/is-spectator/interaction-logger-tool/main/install.sh | bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
INSTALL_DIR="${INSTALL_DIR:-$HOME/.openclaw/workspace/interaction-logger-tool}"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"

echo "🦐 交互日志工具 - 安装脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误：需要安装 Node.js${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本：$(node -v)${NC}"

# 创建安装目录
echo -e "${YELLOW}📁 创建安装目录...${NC}"
mkdir -p "$INSTALL_DIR"

# 下载文件
echo -e "${YELLOW}📥 下载工具文件...${NC}"
cd "$INSTALL_DIR"

# 从 GitHub 下载（如果没有网络，使用本地文件）
if command -v wget &> /dev/null; then
    wget -q https://raw.githubusercontent.com/is-spectator/interaction-logger-tool/main/sync-interaction-log.js || {
        echo -e "${YELLOW}⚠️  无法从 GitHub 下载，使用本地文件...${NC}"
        cp /home/admin/.openclaw/workspace/interaction-logger-tool/sync-interaction-log.js . 2>/dev/null || true
    }
    wget -q https://raw.githubusercontent.com/is-spectator/interaction-logger-tool/main/config.example.json || true
    wget -q https://raw.githubusercontent.com/is-spectator/interaction-logger-tool/main/README.md || true
fi

# 如果没有下载成功，检查本地文件
if [ ! -f "sync-interaction-log.js" ]; then
    if [ -f "/home/admin/.openclaw/workspace/interaction-logger-tool/sync-interaction-log.js" ]; then
        cp /home/admin/.openclaw/workspace/interaction-logger-tool/sync-interaction-log.js .
        cp /home/admin/.openclaw/workspace/interaction-logger-tool/config.example.json . 2>/dev/null || true
        echo -e "${GREEN}✅ 使用本地文件安装成功${NC}"
    else
        echo -e "${RED}❌ 错误：找不到工具文件${NC}"
        exit 1
    fi
fi

# 设置执行权限
chmod +x sync-interaction-log.js

# 创建配置文件
if [ ! -f "config.json" ]; then
    echo -e "${YELLOW}📝 创建配置文件...${NC}"
    cp config.example.json config.json
    
    # 尝试自动检测 OpenClaw 目录
    if [ -d "$OPENCLAW_DIR/agents/main/sessions" ]; then
        sed -i "s|/home/admin/.openclaw/agents/main/sessions|$OPENCLAW_DIR/agents/main/sessions|g" config.json
        echo -e "${GREEN}✅ 已自动配置 OpenClaw 会话目录${NC}"
    fi
    
    echo ""
    echo -e "${RED}⚠️  重要：请编辑配置文件！${NC}"
    echo -e "${YELLOW}   vim config.json${NC}"
    echo ""
    echo "需要配置："
    echo "  - api_base: 你的交互日志平台地址"
    echo "  - bot_token: 你的 Bot Token（需在平台配置）"
    echo "  - sessions_dir: OpenClaw 会话目录（已自动检测）"
    echo ""
    echo -e "${RED}⚠️  未配置前不要运行同步脚本！${NC}"
    echo ""
else
    echo -e "${GREEN}✅ 配置文件已存在，跳过${NC}"
fi

# 添加到 crontab
echo -e "${YELLOW}⏰ 配置定时任务...${NC}"
CRON_JOB="*/1 * * * * cd $INSTALL_DIR && node sync-interaction-log.js >> $INSTALL_DIR/sync.log 2>&1"

if crontab -l 2>/dev/null | grep -q "interaction-logger-tool"; then
    echo -e "${GREEN}✅ 定时任务已存在${NC}"
else
    (crontab -l 2>/dev/null | grep -v "interaction-logger-tool"; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✅ 已添加定时任务（每分钟同步一次）${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 安装完成！${NC}"
echo ""
echo "📁 安装目录：$INSTALL_DIR"
echo "📝 配置文件：$INSTALL_DIR/config.json"
echo "⏰ 定时任务：每分钟自动同步"
echo ""
echo "📖 使用方式："
echo "  # 手动运行一次"
echo "  cd $INSTALL_DIR && node sync-interaction-log.js"
echo ""
echo "  # 调试模式"
echo "  node sync-interaction-log.js --debug"
echo ""
echo "  # 查看日志"
echo "  tail -f $INSTALL_DIR/sync.log"
echo ""
echo "  # 修改配置"
echo "  vim $INSTALL_DIR/config.json"
echo ""
echo -e "${YELLOW}💡 提示：配置交互日志平台地址和 Bot Token 后即可使用${NC}"
echo ""
