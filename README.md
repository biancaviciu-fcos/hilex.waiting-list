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
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## Emailuri de confirmare

Local, dacă nu există o cheie de email configurată, confirmarea este salvată în:

```text
data/email-outbox
```

Pentru trimitere reală prin Resend, setează variabilele:

```bash
RESEND_API_KEY=...
FROM_EMAIL="HiLex <noreply@domeniul-tau.ro>"
NOTIFICATION_EMAILS="echipa@domeniul-tau.ro"
```

`NOTIFICATION_EMAILS` este opțional și poate conține una sau mai multe adrese,
separate prin virgulă. Aceste adrese primesc o notificare internă atunci când
un contact trimite formularul de așteptare, inclusiv dacă emailul există deja.

Data lansarii pentru countdown se poate schimba cu:

```bash
LAUNCH_DATE=2026-06-26T14:00:00+01:00
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

`SUPABASE_URL` trebuie sa fie Project URL simplu, fara `/rest/v1` la final.

Variabile recomandate:

```text
LAUNCH_DATE=2026-06-26T14:00:00+01:00
RESEND_API_KEY=...
FROM_EMAIL=HiLex <noreply@domeniul-tau.ro>
NOTIFICATION_EMAILS=echipa@domeniul-tau.ro
```

## Supabase

In Supabase, deschide SQL Editor si ruleaza continutul din:

```text
supabase-schema.sql
```

Apoi copiaza din Project Settings > API:

- Project URL pentru `SUPABASE_URL`
- service_role secret pentru `SUPABASE_SERVICE_ROLE_KEY`
