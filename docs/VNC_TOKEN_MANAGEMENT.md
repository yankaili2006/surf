# Surf 动态VNC Token管理系统

**版本**: 1.0.0
**日期**: 2026-01-22

## 概述

为了支持多用户并发创建和使用多个E2B sandbox，实现了动态VNC token管理系统。该系统自动管理websockify的token配置，确保每个sandbox都能正确访问其VNC桌面。

## 问题背景

### 原始问题
- 每个sandbox创建时分配不同的IP地址（如10.11.0.9, 10.11.0.10等）
- websockify使用静态token配置文件
- 新创建的sandbox无法访问VNC，因为token配置未更新
- 多用户并发创建sandbox时存在竞态条件

### 错误表现
```
ERROR "Error sending message: TypeError: network error"
```

## 解决方案

### 架构设计

```
用户请求 → Surf前端 → /api/chat (创建sandbox)
                              ↓
                         提取VM IP地址
                              ↓
                    /api/vnc-token (更新token)
                              ↓
                    manage-vnc-token.sh (文件锁)
                              ↓
                    /tmp/vnc_tokens.conf (token配置)
                              ↓
                         websockify (读取token)
```

### 核心组件

1. **Token管理脚本** (`scripts/manage-vnc-token.sh`)
   - 使用文件锁确保并发安全
   - 支持add/remove/list操作
   - 自动管理token配置文件

2. **Token管理API** (`app/api/vnc-token/route.ts`)
   - RESTful API接口
   - POST: 添加/删除token
   - GET: 列出所有token

3. **自动更新集成** (`app/api/chat/route.ts`)
   - 创建sandbox后自动提取VM IP
   - 异步调用token管理API
   - 失败不影响主流程

## 使用方法

### 自动模式（推荐）

创建sandbox时自动更新token，无需手动操作：

```typescript
// Surf会自动处理
// 1. 创建sandbox
// 2. 提取VM IP
// 3. 更新token配置
// 4. 返回VNC URL
```

### 手动模式

如需手动管理token：

```bash
# 添加token
./scripts/manage-vnc-token.sh add <sandbox_id> <vm_ip>

# 删除token
./scripts/manage-vnc-token.sh remove <sandbox_id>

# 列出所有token
./scripts/manage-vnc-token.sh list
```

### API调用

```bash
# 添加token
curl -X POST http://localhost:3001/api/vnc-token \
  -H "Content-Type: application/json" \
  -d '{"action":"add","sandboxId":"abc123","vmIp":"10.11.0.9"}'

# 列出token
curl http://localhost:3001/api/vnc-token
```

## 并发安全

### 文件锁机制

使用目录锁（`/tmp/vnc_tokens.lock`）确保并发安全：

```bash
# 获取锁
mkdir /tmp/vnc_tokens.lock

# 执行操作
echo "token: ip:port" >> /tmp/vnc_tokens.conf

# 释放锁
rmdir /tmp/vnc_tokens.lock
```

### 超时处理

- 锁超时时间：10秒
- 超时后返回错误，不影响其他请求

## Token配置格式

```
# /tmp/vnc_tokens.conf
# Format: token: target_host:target_port

icldmuinnpwzr2ez75ijm: 10.11.0.9:5900
ix89t5sg70jcszcc4j53k: 10.11.0.10:5900
```

## VNC访问URL

```
http://100.64.0.23:6080/vnc.html?path=websockify?token=<sandbox_id>&autoconnect=true
```

## 测试

### 单用户测试

1. 访问 http://100.64.0.23:3001
2. 发送消息创建sandbox
3. 等待VNC连接建立
4. 验证桌面可访问

### 多用户测试

1. 打开多个浏览器窗口
2. 同时创建多个sandbox
3. 验证每个sandbox都能正确访问VNC
4. 检查token配置文件无冲突

## 故障排除

### Token未更新

检查日志：
```bash
tail -f /tmp/surf.log | grep "VNC token"
```

手动添加token：
```bash
./scripts/manage-vnc-token.sh add <sandbox_id> <vm_ip>
```

### 并发冲突

检查锁状态：
```bash
ls -la /tmp/vnc_tokens.lock
```

清理死锁：
```bash
rmdir /tmp/vnc_tokens.lock
```

### VNC连接失败

验证token配置：
```bash
./scripts/manage-vnc-token.sh list
```

测试VNC端口：
```bash
nc -zv <vm_ip> 5900
```

## 性能考虑

- Token更新是异步的，不阻塞sandbox创建
- 文件锁超时10秒，避免长时间等待
- websockify在每次连接时读取token，无需重启

## 未来改进

- [ ] 使用Redis替代文件存储，提高并发性能
- [ ] 添加token过期机制，自动清理旧token
- [ ] 实现token使用统计和监控
- [ ] 支持token权限控制

---

**相关文件**:
- `scripts/manage-vnc-token.sh` - Token管理脚本
- `app/api/vnc-token/route.ts` - Token管理API
- `app/api/chat/route.ts` - Sandbox创建集成
- `/tmp/vnc_tokens.conf` - Token配置文件
