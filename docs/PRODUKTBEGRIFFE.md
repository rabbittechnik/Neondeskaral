# Produktbegriffe (einheitliche Benennung)

Diese Begriffe beschreiben die drei Zugangsarten zur Anwendung:

| Begriff | Bedeutung |
|--------|-----------|
| **Mitarbeiter-App** | Persönlicher Handy-Zugang (QR pro Person, eigenes Gerät). Routen: `/employee`, `/employee/:token` (ältere Links `/employee-access/…` leiten um). |
| **Stations-Tablet** | Terminal-Zugang für die Tankstelle (Gerät an der Station, z. B. gemeinsames Tablet mit Stations-QR). Routen: `/tablet`, `/tablet/:tabletToken`. |
| **Admin-App** | Login für Chef / Teamleitung (volle bzw. rollenbasierte Verwaltungsoberfläche). Routen: u. a. `/login`, `/dashboard`. |

**PWA-Start:** `start_url` `/app` — es wird nur anhand gespeicherter Tokens entschieden (Mitarbeiter / Tablet / Admin), nicht anhand „installiert“ oder `display-mode`.

**Hinweis für Entwicklung:** Die REST-Pfade bleiben z. B. `/api/employee-access/…` und `/api/tablet/…` (API ≠ Browser-Routen).
