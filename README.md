# Evolvi Fit

MVP de um app para personal trainers prescreverem treinos e acompanharem alunos, inspirado no MFIT.

- **Personal:** cria o acesso dos alunos (email + senha inicial), gerencia treinos (divisões +
  exercícios), arquiva/reativa rotinas, reenvia acesso por email e acompanha a atividade da turma.
- **Aluno:** entra já vinculado ao personal, vê os treinos ativos e registra treinos concluídos no
  histórico.

## Stack

- Expo (SDK 58) + React Native + TypeScript
- Expo Router (file-based routing)
- Supabase (Auth + Postgres + RLS)

## Estrutura

```
src/
  app/
    _layout.tsx        # providers + Stack raiz
    index.tsx          # redireciona por papel (personal/aluno)
    login.tsx
    signup.tsx
    personal/          # Stack do personal
      (tabs)/
        index.tsx      # alunos + criar acesso
        treinos.tsx    # lista de treinos
        perfil.tsx
      novo-aluno.tsx   # cria o acesso do aluno já vinculado
      novo-treino.tsx  # criação de treino (com biblioteca de exercícios)
    aluno/             # Stack do aluno
      (tabs)/
        index.tsx      # treinos prescritos
        historico.tsx  # sessões concluídas + duração
        perfil.tsx     # dados, lembretes e personal
      treino/[id].tsx  # execução do treino (cronômetro + descanso)
  components/ui/       # Button, Card, Screen, TextField, Loading
  lib/                 # supabase client, convites, tipos, formatação
  providers/           # AuthProvider (sessão + perfil)
supabase/
  schema.sql           # tabelas, funções e RLS
  invites.sql          # convites de alunos + onboarding (anamnese)
  exercises_seed.sql   # biblioteca global de exercícios com vídeos
```

## Como rodar

### 1. Criar o projeto no Supabase

1. Crie um projeto em https://supabase.com.
2. Abra o **SQL Editor** e execute todo o conteúdo de `supabase/schema.sql`.
3. Ainda no **SQL Editor**, execute `supabase/exercises_seed.sql` para carregar a biblioteca
   de exercícios com vídeos e instruções (pode rodar novamente para atualizar).
4. Execute também `supabase/upgrade_v2.sql` para criar os registros de carga/reps por exercício
   na sessão de treino.
   Se o projeto já usava o vínculo por código, execute `supabase/remove_link_code.sql` uma vez.
5. Execute `supabase/invites.sql` para habilitar os convites de alunos, a data de nascimento no
   perfil e a gravação automática da anamnese no onboarding.
6. Em **Authentication > URL Configuration**, adicione `evolvifit://**`,
   `exp://**/--/**` e a URL do site (ex.: `https://evolvi-fit.vercel.app/**`) em
   **Redirect URLs** para os links de recuperação de senha e confirmação de email funcionarem.
7. Em **Authentication > Providers > Email**, desative "Confirm email" para testar mais rápido.
   Se mantiver ativo, o aluno que recebeu o convite precisa confirmar o email antes de entrar
   (o app avisa na tela de convite).

### 2. Configurar variáveis de ambiente

Edite o arquivo `.env` na raiz:

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
EXPO_PUBLIC_APP_URL=https://evolvi-fit.vercel.app
```

A URL e a anon key ficam em **Project Settings > API** no Supabase.
`EXPO_PUBLIC_APP_URL` é opcional: quando definida, os links de convite usam essa URL
pública em vez do deep link do app.

### 3. Instalar e iniciar

```bash
npm install
npx expo start
```

Abra no Expo Go, emulador Android/iOS ou no navegador (`w`).

### 4. Versão web / PWA (link instalável)

O app também roda no navegador e pode ser instalado na tela inicial como um app
(PWA). Os arquivos ficam em `public/`:

- `manifest.json` — nome, ícones, cor do tema e modo `standalone`.
- `sw.js` — service worker (abre offline e atualiza em segundo plano).
- `index.html` — template do HTML com as metas de PWA e registro do service worker.
- `icons/` — ícones 192/512, maskable e Apple Touch Icon.

Gerar o build web:

```bash
npm run export:web     # gera a pasta dist/
npm run serve:web      # testa localmente em http://localhost:3000
```

Para publicar, envie a pasta `dist/` para um serviço de hospedagem estática
(Netlify, Vercel, Cloudflare Pages ou Expo Hosting). O arquivo
`public/_redirects` já configura o fallback da SPA em Netlify/Cloudflare Pages
(`/* /index.html 200`). Na Vercel, rode `npx vercel --prod`: o `vercel.json` já
define o build (`npx expo export -p web`), as rewrites e os headers. Lembre de
configurar `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` nas
Environment Variables do projeto na Vercel. O site precisa estar em **HTTPS**
para o PWA instalar.

Produção atual: https://evolvi-fit.vercel.app

Depois de publicado:

- **Android (Chrome):** menu `⋮` → **Instalar app**.
- **iPhone (Safari):** **Compartilhar** → **Adicionar à Tela de Início**.

## Fluxo de teste

1. Cadastre-se como **personal** (o cadastro no app é exclusivo para personal trainers).
2. Na aba **Alunos**, toque em **Criar acesso de aluno**, informe nome, email (com confirmação)
   e senha inicial. O aluno já fica vinculado e você pode compartilhar os dados de acesso.
   Se o aluno esquecer a senha, use **Esqueci minha senha** na tela de login.
3. Entre com o email e a senha criados para testar a visão do aluno.
4. No app do personal, o aluno aparece em **Alunos**; crie um treino em **Treinos > Novo treino**
   e use **+ Escolher da biblioteca** para selecionar exercícios prontos. Toque no ícone de play
   para assistir ao vídeo curto dentro do app. Em **Treinos** você pode buscar pelo nome do aluno,
   editar, arquivar/reativar ou excluir um treino. Treinos arquivados somem da visão do aluno.
   No perfil do aluno, use **Acesso do aluno** para enviar link de redefinição de senha ou
   reenviar a confirmação de email.
5. No app do aluno, aba **Treino**, toque em **Iniciar treino** para abrir a execução.
6. Na execução, marque os exercícios concluídos, acompanhe o cronômetro total e use o botão
   **Descanso** (com **+15s** / **Pular**). Toque em **Finalizar treino**.
7. O treino concluído aparece em **Histórico** com a duração registrada.

## Segurança

Todas as tabelas usam **Row Level Security (RLS)**:

- O personal só acessa alunos vinculados a ele.
- O aluno só acessa seus próprios treinos e histórico.
- O personal cria o acesso do aluno e insere o vínculo em `coach_students` (RLS exige
  `coach_id = auth.uid()`).
- Alunos não se cadastram sozinhos: o acesso é sempre criado pelo personal.

## Vídeos dos exercícios

Os vídeos curtos são reproduzidos dentro do app com `expo-video`. As URLs atuais apontam para o
CDN público do projeto [free-exercise-db-with-videos](https://github.com/harshvishu/free-exercise-db-with-videos)
(metadados sob licença MIT; vídeos disponibilizados para demonstração). Para produção, recomenda-se
hospedar os vídeos em um serviço próprio (Bunny.net / Cloudflare Stream) e atualizar `video_url` na
tabela `exercises`.

## Próximos passos (fase 2)

- Hospedar vídeos próprios (Bunny.net / Cloudflare Stream) em vez do CDN de demonstração
- Telas de anamnese e avaliação física (tabelas já criadas)
- Duplicar treino para outro aluno
- Edição do email/telefone do aluno pelo personal
- Pagamentos (Mercado Pago / Asaas) e controle financeiro
- Chat personal <-> aluno e notificações
- Build de produção com EAS (`npx eas-cli build`)
