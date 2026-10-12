# Stavebný archív – zdrojový balík

Obsah:
- web/: aktuálny zdrojový kód súkromnej webovej aplikácie Sites.
- android/: Android aplikácia s firemným logom, ktorá otvorí online archív v prehliadači.

Nasadený archív: https://stavebny-archiv.jakub-novak421.chatgpt.site/

Android balík je samostatne v súbore stavebny-archiv.apk. Pokyny na inštaláciu a zostavenie sú v android/README.md.

V balíku nie sú heslá, súkromné podpisové kľúče, node_modules, história Git ani uložené záznamy, fotografie a obsah cloudovej databázy. Dáta zostávajú online v pôvodnej aplikácii.

Pre web nainštaluj závislosti podľa pnpm-lock.yaml a postupuj podľa web/README.md. Spustenie rovnakého servera vyžaduje D1, R2 a autentifikáciu poskytovanú Sites; samotné otvorenie zdrojových súborov nemôže nahradiť server.
