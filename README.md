# Plataforma J — Plataforma SaaS Premium de Ensino

Plataforma completa de ensino online para criadores de conteúdo premium.  
Stack: **Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL · Auth.js v5**

---

## Estrutura do Projeto

```
PlataformaF/
├── prisma/
│   ├── schema.prisma         # Schema completo do banco de dados
│   └── seed.ts               # Dados iniciais para desenvolvimento
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/route.ts  # Handler do Auth.js
│   │   ├── (auth)/           # Grupo: login, register, etc.
│   │   ├── (platform)/       # Grupo: dashboards protegidos
│   │   │   ├── student/      # Área do aluno
│   │   │   ├── professor/    # Área do professor
│   │   │   └── admin/        # Área do admin
│   │   ├── globals.css       # Estilos globais + variáveis CSS
│   │   ├── layout.tsx        # Layout raiz
│   │   └── page.tsx          # Landing page pública
│   │
│   ├── components/
│   │   ├── providers/        # ThemeProvider, SessionProvider
│   │   ├── ui/               # Componentes shadcn/ui base
│   │   ├── layout/           # Sidebar, Header, Footer
│   │   ├── dashboard/        # Cards e widgets de dashboard
│   │   └── landing/          # Componentes da landing page
│   │
│   ├── lib/
│   │   ├── prisma.ts         # Singleton do Prisma Client
│   │   ├── auth.ts           # Configuração Auth.js v5
│   │   ├── utils.ts          # Funções utilitárias
│   │   ├── constants.ts      # Constantes globais e temas
│   │   └── validations.ts    # Schemas Zod
│   │
│   ├── types/
│   │   ├── index.ts          # Tipos TypeScript centralizados
│   │   └── next-auth.d.ts    # Augmentação de tipos do Auth.js
│   │
│   └── middleware.ts         # Proteção de rotas por role
│
├── .env.example              # Template de variáveis de ambiente
├── components.json           # Configuração do shadcn/ui
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Pré-requisitos

- **Node.js** >= 18.x
- **PostgreSQL** >= 14 (local ou Docker)
- **npm** ou **pnpm**

---

## Como Rodar o Projeto

### 1. Clonar e instalar dependências

```bash
cd PlataformaF
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Abra o `.env` e configure:

```env
# URL do seu PostgreSQL
DATABASE_URL="postgresql://postgres:senha@localhost:5432/plataformaj"

# Segredo do Auth.js (gere um seguro: openssl rand -base64 32)
AUTH_SECRET="seu-segredo-aqui"
NEXTAUTH_SECRET="seu-segredo-aqui"

NEXTAUTH_URL="http://localhost:3000"
```

### 3. Configurar o banco de dados

```bash
# Criar as tabelas (modo desenvolvimento)
npm run db:push

# Ou com migrations versionadas
npm run db:migrate
```

### 4. Popular o banco com dados de teste

```bash
npm run db:seed
```

Isso criará os seguintes usuários:

- 1 conta de administrador
- 2 contas de professor
- 5 contas de aluno

As credenciais de seed sao apenas para desenvolvimento local e devem ser definidas em variaveis de ambiente ou no proprio script de seed, sem publicacao em documentacao versionada.

### 5. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Scripts Disponíveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build de produção
npm run start      # Iniciar servidor de produção
npm run lint       # Lint com ESLint

npm run email:check # Valida configuração de email (modo atual)
npm run email:check:prod # Validação estrita para produção
npm run email:test  # Envia email de teste (Resend/SMTP/Ethereal local)

npm run db:push    # Sincroniza schema sem migrations
npm run db:migrate # Cria migration e aplica
npm run db:seed    # Popula o banco com dados de teste
npm run db:studio  # Abre o Prisma Studio (GUI do banco)
npm run db:reset   # Reseta o banco e re-popula
```

---

## Checklist de Email em Produção

1. Configure `EMAIL_FROM` com domínio válido da sua empresa (ex.: `Plataforma J <noreply@seudominio.com>`).
2. Configure um provedor de envio:
   - Resend: `RESEND_API_KEY`
   - ou SMTP completo: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
3. Garanta `NEXT_PUBLIC_APP_URL` com HTTPS (ex.: `https://app.seudominio.com`).

Antes do deploy, rode:

```bash
npm run email:check:prod
```

Para disparar um teste manual de envio:

```bash
npm run email:test -- seu@email.com
```

---

## Credenciais dos Temas

### Muay Thai (Mestre Silva)

- Fundo escuro com vermelho
- Slug: `mestre-silva`
- Niche: `muaythai`

### Fitness (Coach Thiago)

- Fundo preto com branco e azul
- Slug: `academia-elite`
- Niche: `fitness`

---

## Planos

| Plano   | Preço      | Premium | Lives | Treino Personalizado |
| ------- | ---------- | ------- | ----- | -------------------- |
| Básico  | R$ 97/mês  | ❌      | ❌    | ❌                   |
| Premium | R$ 197/mês | ✅      | ✅    | ✅                   |

---

## Ordem de Entrega das Etapas

| Etapa | Conteúdo                                        | Status       |
| ----- | ----------------------------------------------- | ------------ |
| 1     | Estrutura, schema, seed, config base            | ✅ Concluído |
| 2     | Autenticação, roles, formulários login/register | 🔜 Próximo   |
| 3     | Dashboards (aluno, professor, admin)            | 🔜           |
| 4     | Sistema de cursos, módulos, aulas, progresso    | 🔜           |
| 5     | Planos, assinaturas, lives premium              | 🔜           |
| 6     | Refinamento visual, componentes extras          | 🔜           |

---

## Deploy (Vercel + Neon/Supabase)

1. Crie um projeto no [Vercel](https://vercel.com)
2. Configure o banco PostgreSQL no [Supabase](https://supabase.com) ou [Neon](https://neon.tech)
3. Configure as variáveis de ambiente no painel do Vercel
4. Deploy automático via Git push

```bash
# Produção: use migrations ao invés de db:push
npx prisma migrate deploy
```

---

## Tecnologias

| Tecnologia    | Versão   | Uso                              |
| ------------- | -------- | -------------------------------- |
| Next.js       | 15.1     | Framework principal (App Router) |
| TypeScript    | 5.x      | Tipagem estática                 |
| Tailwind CSS  | 3.4      | Estilização utility-first        |
| shadcn/ui     | latest   | Componentes acessíveis           |
| Prisma        | 5.22     | ORM + migrações                  |
| PostgreSQL    | 14+      | Banco de dados relacional        |
| Auth.js v5    | 5.0-beta | Autenticação (JWT + Credentials) |
| Zod           | 3.x      | Validação de schemas             |
| Recharts      | 2.x      | Gráficos nos dashboards          |
| Sonner        | 1.x      | Notificações toast               |
| Framer Motion | 11.x     | Animações                        |
