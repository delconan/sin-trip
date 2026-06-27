# 狮城小队 · 新加坡亲子互动行程

面向 2026 年 7 月 7–10 日、两大两小的新加坡互动旅行手账。无需云端配置即可使用完整本地演示；配置 Supabase 与 OneMap 后，自动启用私密链接、多设备实时同步与官方路线查询。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。本地调整保存到浏览器 `localStorage`。

## 启用多设备同步

1. 创建 Supabase 项目，在 Authentication → Providers 中启用 Anonymous Sign-Ins。
2. 使用 Supabase SQL Editor 执行 `supabase/migrations/202606280001_initial_schema.sql`。
3. 复制 `.env.example` 为 `.env.local`，填入 Supabase URL、publishable key 与 service role key。
4. 创建 OneMap API 账号，填写 `ONEMAP_API_EMAIL` 与 `ONEMAP_API_PASSWORD`。
5. 重启开发服务器。首次打开会自动创建行程，并把地址改为 `/trip#<私密令牌>`。

分享链接是编辑凭证：拿到链接的人可以查看和修改行程。“重置访问”会轮换令牌并撤销其他匿名设备。

## Vercel 部署

将仓库导入 Vercel，在 Project Settings → Environment Variables 填入 `.env.example` 中的变量，然后部署。`SUPABASE_SERVICE_ROLE_KEY` 与 OneMap 密码只能配置为服务端变量，绝不能添加 `NEXT_PUBLIC_` 前缀。

## 验证命令

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

票价数据核对日期为 2026-06-27；应用只提供来源与预算参考，不处理付款。OneMap 暂不可用时会回退到本地估时，并保留 Google Maps 导航入口。

