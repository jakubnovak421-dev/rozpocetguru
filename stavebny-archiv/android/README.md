# Stavebný archív – Android

Inštalovateľná Android aplikácia s firemným logom. Z úvodnej obrazovky otvorí súkromný online archív v predvolenom prehliadači telefónu. Potrebuje internet; neobsahuje offline kópiu dát ani databázy.

## Inštalácia dodaného APK

1. Stiahni `stavebny-archiv.apk` do telefónu a otvor ho.
2. Ak Android vyžiada povolenie, povoľ inštaláciu z aplikácie, cez ktorú si súbor otvoril.
3. Po inštalácii otvor Stavebný archív a stlač Otvoriť archív.
4. Prihlás sa cez svoj účet ChatGPT.

APK nevyžaduje oprávnenia ku kontaktom, úložisku alebo polohe. Fotografie a dokumenty vyberáš cez webový archív v prehliadači. Prihlásenie a súkromný prístup zostávajú spravované službou Sites.

## Zostavenie

Otvor tento priečinok v Android Studio. Použi JDK 17 a Android SDK 35. Gradle projekt neobsahuje Gradle wrapper; Android Studio môže použiť nainštalovaný Gradle 8.9. Príkaz `gradle :app:assembleDebug` vytvorí APK s lokálnym vývojovým podpisom. Release podpis nastav vlastným kľúčom.

Dodaný APK bol zostavený priamo pomocou Android SDK Build Tools 35 (aapt2, Eclipse ECJ, d8, zipalign, apksigner) a samostatného vývojového kľúča. Tento súkromný podpisový kľúč nie je súčasťou zdrojového ZIP. Vlastné APK s iným podpisom vyžaduje odinštalovanie pôvodnej Android aplikácie; online záznamy tým nezmiznú.

Balík: sk.kubo.stavebnyarchiv. Android 8.0 alebo novší. Vzhľad a beh na fyzickom telefóne neboli v tomto prostredí otestované.
