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

Contactele se salveaza in doua formate:

- `data/contacts.json`
- `data/contacts.csv`

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

## Deploy pe Render

Fisierul `render.yaml` pregateste un Web Service Node.js in regiunea Frankfurt, cu disk persistent montat la `/var/data`.

In Render:

1. Creeaza un repo GitHub cu acest proiect.
2. In Render, alege New > Blueprint.
3. Conecteaza repo-ul.
4. La variabilele cerute, completeaza `RESEND_API_KEY` si `FROM_EMAIL`.
5. Porneste deploy-ul.

Contactele din productie se vor salva pe disk-ul persistent Render, in:

```text
/var/data/contacts.csv
/var/data/contacts.json
```
