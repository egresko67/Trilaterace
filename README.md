# Egg Finder - Minecraft POI Trilaterace

Webová aplikace pro kolaborativní trilateraci bodů zájmu (zejména vajec) v Minecraftu na ploše 400x400 bloků.

## Funkce
- **Real-time synchronizace:** Více uživatelů může skládat mapu společně díky Firebase Realtime Database.
- **Automatický reset:** Data se automaticky resetují každý den o půlnoci (změna poloh cílů).
- **Interaktivní mapa:** Moderní tmavý vizuál (Canvas) s mřížkou a vizualizací měření.
- **Odhad vejce:** Automatický výpočet průsečíků kružnic s možností zobrazení přesných souřadnic při najetí myší.

## Instalace a Nastavení

### 1. Firebase Projekt
Aby aplikace fungovala, je potřeba ji propojit s vaším Firebase projektem:
1. Přejděte do [Firebase Console](https://console.firebase.google.com/).
2. Vytvořte nový projekt (např. "Egg-Finder").
3. Aktivujte **Realtime Database** (doporučujeme region `europe-west1`).
4. V nastavení projektu přidejte **Webovou aplikaci** a zkopírujte konfigurační objekt `firebaseConfig` do souboru `app.js`.
5. V záložce **Rules** (Pravidla) databáze nastavte bezpečný přístup (viz tipy v diskuzi).

### 2. GitHub Pages
1. Nahrajte tento kód do svého GitHub repozitáře `egresko67/Trilaterace`.
2. V nastavení repozitáře (**Settings -> Pages**) zvolte jako zdroj větev `main`.
3. Aplikace bude dostupná na `https://egresko67.github.io/Trilaterace/`.

## Jak to funguje
- Uživatelé vkládají svou aktuální pozici (X, Z) a vzdálenost (R) k nejbližšímu cíli.
- Aplikace vykreslí kružnici s daným poloměrem.
- Průsečíky více kružnic (oranžové body) označují pravděpodobnou polohu cíle.
- Najetím myší na oranžový bod na mapě získáte přesné souřadnice pro teleport/cestu.
