# HiLex waitlist

Pagina include formularul de inscriere, salvarea contactelor si confirmarea email.

## Pornire locala

```bash
npm start
```

Pagina ruleaza implicit la:

```text
http://127.0.0.1:4173
```

## Unde se salveaza contactele

Local, contactele se salveaza in doua formate:

- `data/contacts.json`
- `data/contacts.csv`

In productie pe Render free, foloseste Supabase si seteaza:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Emailuri de confirmare

Local, daca nu exista o cheie de email configurata, confirmarea este salvata in:

```text
data/email-outbox
```

Pentru trimitere reala prin Resend, seteaza variabilele:

```bash
RESEND_API_KEY=...
FROM_EMAIL="HiLex <noreply@domeniul-tau.ro>"
```

Data lansarii pentru countdown se poate schimba cu:

```bash
LAUNCH_DATE=2026-09-01T09:00:00+03:00
```

## Deploy pe Render free

Varianta recomandata pentru Render free este Web Service manual + Supabase pentru contacte.

In Render:

1. Creeaza un repo GitHub cu acest proiect.
2. In Render, alege New > Web Service.
3. Conecteaza repo-ul.
4. Alege runtime Node.
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Adauga variabilele de mediu de mai jos.

Variabile obligatorii pe Render:

```text
HOST=0.0.0.0
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Variabile recomandate:

```text
LAUNCH_DATE=2026-09-01T09:00:00+03:00
RESEND_API_KEY=...
FROM_EMAIL=HiLex <noreply@domeniul-tau.ro>
```

## Supabase

In Supabase, deschide SQL Editor si ruleaza continutul din:

```text
supabase-schema.sql
```

Apoi copiaza din Project Settings > API:

- Project URL pentru `SUPABASE_URL`
- service_role secret pentru `SUPABASE_SERVICE_ROLE_KEY`
