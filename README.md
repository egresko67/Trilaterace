# Trilaterace - Therapie

Webová aplikace pro kolaborativní trilateraci bodů zájmu v Minecraftu.

## Funkce
- **Real-time synchronizace:** Více uživatelů může skládat mapu společně díky Firebase.
- **Automatický reset:** Data se automaticky resetují každý den o půlnoci.
- **Vizuální mapa:** Zobrazení měření a jejich průsečíků na 2D plátně (Canvas).
- **Trilaterace:** Výpočet průsečíků kružnic pro přesný odhad polohy 10 cílů.

## Instalace a Nastavení

### 1. Firebase Projekt
Aby aplikace fungovala, je potřeba ji propojit s vaším Firebase projektem:
1. Přejděte do [Firebase Console](https://console.firebase.google.com/).
2. Vytvořte nový projekt (např. "Trilaterace-Therapie").
3. V nastavení projektu přidejte **Webovou aplikaci** a zkopírujte konfigurační objekt `firebaseConfig`.
4. Aktivujte **Realtime Database** a v záložce "Rules" (Pravidla) nastavte oprávnění pro čtení i zápis (pro testování můžete nastavit `true`, pro produkci doporučujeme zabezpečit).

### 2. Aktualizace app.js
Otevřete soubor `app.js` a nahraďte hodnoty v objektu `firebaseConfig` těmi, které jste získali z Firebase Console.

### 3. GitHub Pages
1. Nahrajte tento kód do svého GitHub repozitáře.
2. V nastavení repozitáře (**Settings -> Pages**) zvolte jako zdroj větev `main`.
3. Aplikace bude dostupná na `https://MantixXd.github.io/Trilaterace-Therapie/`.

## Jak to funguje
- Uživatelé vkládají svou aktuální pozici (X, Z) a vzdálenost (R) k nejbližšímu bodu zájmu.
- Aplikace automaticky ukládá tato data pod dnešním datem.
- Na mapě se zobrazují kružnice a jejich průsečíky (žluté body), které ukazují na hledané cíle.
