# Segurança e Resposta a Incidentes

## Contatos de Segurança

- E-mail de segurança: security@plataformaj.com
- E-mail de privacidade (LGPD): privacidade@plataformaj.com

## Plano de Contenção Imediata

1. Revogue e rotacione segredos imediatamente: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, chaves SMTP/API.
2. Invalide sessões ativas e redefina credenciais dos usuários afetados.
3. Desative integrações/endpoints suspeitos enquanto o diagnóstico ocorre.
4. Preserve evidências (logs, IDs de requisição, snapshots do banco) antes de qualquer limpeza.

## Checklist de Rotação de Segredos

1. Gere novos segredos fortes:

- `openssl rand -base64 32` (ou CSPRNG equivalente).

2. Substitua apenas no armazenamento seguro de variáveis de ambiente (nunca em arquivos versionados).
3. Confirme que o segredo de webhook Stripe começa com `whsec_` e corresponde ao endpoint correto.
4. Reimplante a aplicação e valide fluxos de autenticação e cobrança.
5. Revogue as chaves antigas nos painéis dos provedores.

## Resposta a Vazamento de Dados (PII)

1. Identifique as classes de dados expostas: conta, perfil, cobrança, auditoria e suporte.
2. Delimite a janela de impacto e os usuários afetados.
3. Acione jurídico/compliance e siga as obrigações da LGPD.
4. Notifique os usuários impactados com instruções claras de mitigação.
5. Publique relatório pós-incidente com linha do tempo e correções aplicadas.

## Controles Preventivos

1. Mantenha dependências atualizadas (`npm audit --omit=dev` semanal).
2. Aplique princípio do menor privilégio em ações administrativas e server actions.
3. Utilize tokens de reset com hash e TTL curto.
4. Mantenha `AUTH_DEBUG=false` em produção e evite logs com PII em texto claro.
5. Restrinja hosts remotos de imagem e aplique headers CSP.

## Validação Controlada de Segurança

- Verificações estáticas:
  - `npm run lint`
  - `npm audit --omit=dev`
- Verificações dinâmicas (baseline OWASP ZAP):
  - Use apenas ambiente de staging.
  - Execute varredura ativa somente com autorização explícita.
  - Salve relatórios HTML/JSON e crie tarefas de correção por severidade.

## Higiene de Git Após Exposição de Segredos

1. Garanta que `.env` esteja ignorado e não rastreado.
2. Remova segredos já commitados do histórico com reescrita de histórico no repositório Git real.
3. Rotacione forçadamente todos os segredos expostos, mesmo após limpeza do histórico.
4. Invalide caches/artefatos que possam conter valores vazados.
