# FOORS+ Routing-Algorithmus: Flood-Optimized Opportunistic Routing with Sink Awareness

Diese Spezifikation beschreibt den  Routing-Algorithmus für das BLE-Mesh-Triage-System mit Fokus auf minimale Latenz, realistische Verbindungsbedingungen und Mehr-Senken-Fähigkeit.

---

## 1. Motivation und technische Einordnung

Der FOORS+ Algorithmus wurde speziell für den realen Einsatz in Katastrophensituationen entworfen, in denen folgende Faktoren dominieren:

| Faktor                                                   | Priorität                   |
| -------------------------------------------------------- | --------------------------- |
| ⏱ Niedrigste Latenz zur Senke                            | 🔴 Höchste Priorität        |
| 🔁 Hohe Instabilität (kurze Begegnungen, ändernde Pfade) | 🔴 Muss robust sein         |
| 🔋 Energieeffizienz                                      | 🟨 Wichtig, aber nachrangig |
| 📡 Kein zentrales Routing                                | 🔴 Muss dezentral sein      |
| 🧠 Minimaler Overhead & einfache Logik                   | 🟩 Wünschenswert            |

Daraus ergeben sich drei fundamentale Designprinzipien:

✅ **1. Verbindungen sind teuer**

* BLE-Verbindungen brauchen oft Sekunden zum Aufbau und schlagen häufig fehl.
* Aktives "Polling" oder "Pingen" von Peers ist zu aufwändig.
* Daher: keine permanente Verbindungsstrategie, sondern **passives Reagieren auf Gelegenheiten**.

✅ **2. Daten senden = Gelegenheit nutzen**

* Wenn eine Verbindung steht, muss sie **sofort genutzt** werden.
* Die Annahme ist: man weiß nicht, ob man diesen Peer je wiedertrifft.
* Also: **aggressives, aber gezieltes Weitergeben** aller relevanten Daten

✅ **3. Flooding ist praktikabel**

* Anders als in klassischen Netzwerken, ist gleichzeitige Überlast durch viele Verbindungen **praktisch ausgeschlossen**.
* In Tests zeigte sich: maximal 1–2 stabile Verbindungen gleichzeitig pro Node.
* Deshalb ist Flooding **vertretbar**, solange es kontrolliert geschieht und an Guard-Bedingungen geknüpft ist.

Diese Gegebenheiten machten es unmöglich, klassische Ad-hoc- oder Delay-Tolerant-Routingprotokolle wie AODV oder PRoPHET zu übernehmen. Stattdessen wurde mit FOORS+ ein dezentraler, zustandsarmer Algorithmus entworfen, der **jede Verbindung ausnutzt**, **Redundanz vermeidet**, und **Senken gezielt bevorzugt**, sobald sie bekannt sind.

**FOORS+** kombiniert opportunistisches Flooding mit gezieltem Routing basierend auf aktuellen Routingtabellen zu bekannten Senken.

* Sobald eine Verbindung besteht, wird sie **sofort** genutzt
* Falls ein Ziel (Senke) bekannt ist, wird **gezielt geroutet**
* Andernfalls wird **intelligentes Flooding** betrieben (nur wenn Flooding-Policy aktiv)

---

## 2. Datenstrukturen

### 2.1 Routing-Tabelle (pro Senke)

Jede Node hält **eine Routing-Tabelle pro Senke**:

```python
routing_table[sink_id] = {
  'next_hops': {
    peer_id_1: hop_count_1,
    peer_id_2: hop_count_2,
    ...
  },
  'last_update': timestamp
}
```

**Anmerkungen:**

* Eine Node kennt **mehrere Next Hops** zu einer Senke (Redundanz)
* `hop_count` gibt die Distanz zur Senke über diesen Peer an
* Nach **10 Minuten ohne Update** wird die Tabelle **inaktiv** (Senke vermutlich verloren)

### 2.2 Lokaler Triage-Speicher

```python
known_triages = Set[uuid]
triage_storage = Dict[uuid, triage_object]
```

Jede Triage wird nur **einmal weitergeleitet** und **persistent gespeichert**, um bei plötzlichem Verbindungsverlust Daten nicht zu verlieren.

---

## 3. Events

Der Algorithmus basiert auf einem endlichen Zustandsmodell, in dem jede Node (N) ihren lokalen Speicher, ihre Routingtabellen und die Menge aktuell verbundener Peers verwaltet. Formal sei eine Node definiert durch den Zustand:

```text
N = (known_triages, triage_storage, routing_tables, active_connections)
```

Jedes Event ist eine Zustandsübergangsfunktion δ: (State × Event → State), die den Knoten lokal verändert und ggf. Nachrichten an Nachbarn generiert.

### 3.1 `ConnectionEstablished(peer_id)`

* Input: ein neuer Peer p tritt in `active_connections` ein.
* Transition:

  * Füge p zu `active_connections` hinzu.
  * Vergleiche `routing_table[sink]` mit Routinginformationen von p.
  * Falls p einen kleineren HopCount zu einer Senke S bietet, aktualisiere `routing_table[S]`.
  * Erzeuge Nachrichten:

    * `RoutingUpdate(sink_id, hop_count)` an p.
    * Für jedes `triage ∈ triage_storage` mit `triage.id ∉ peer.known_triages`: sende `TriageMessage(triage)`.

#### Abgleich der Triagen zwischen zwei Stores

Wenn zwei Nodes A und B verbunden werden, läuft ein expliziter Abgleichsprozess:

1. **Initialer Abgleich:**

   * Statt kompletter ID-Sets kann eine Node eine komprimierte *Skizze* ihrer Menge bekannter Triagen verschicken.
   * Mögliche Verfahren:

     * **Bloom-Filter:** platzsparend, liefert schnelle Approximation, hat aber False Positives.
     * **ID-Set:** exakte, aber große Liste aller UUIDs.
     * **IBLT (Invertible Bloom Lookup Table) oder minisketch:** moderne Set-Reconciliation-Techniken, die aus zwei Skizzen die *exakte Differenz* rekonstruieren können und deutlich weniger Bandbreite verbrauchen.

2. **Differenzberechnung:**

   * Jede Seite dekodiert aus der Kombination der beiden Skizzen die Mengen `missing_A` und `missing_B`.
   * Vorteil: bei IBLT/minisketch ist die Kommunikationslast linear in der Differenzgröße, nicht in der Gesamtanzahl der IDs.

3. **Gezieltes Senden:**

   * A überträgt alle `triage ∈ triage_storage_A` mit `triage.id ∈ missing_A`.
   * B überträgt alle `triage ∈ triage_storage_B` mit `triage.id ∈ missing_B`.

4. **Priorisierung:**

   * Falls Bandbreite oder Zeit knapp ist, werden Nachrichten nach Triage-Level (RED > YELLOW > GREEN > BLACK) priorisiert.

5. **Abschluss:**

   * Nach Austausch gilt: `known_triages_A ≈ known_triages_B` (bis auf Synchronisationslatenz).

Dieser Mechanismus stellt sicher, dass nur fehlende Einträge gesendet werden. Durch den Einsatz von Skizzen wie Bloom-Filtern oder IBLTs wird zusätzlich Energie und Bandbreite gespart, während doppelte Übertragungen vermieden werden.

##### Wire-Protocol (minisketch-Variante)

**Hashing der UUIDv4:** Mappe jede `uuid` deterministisch auf ein 64‑Bit-Integer `h = H(uuid)` (z. B. SipHash‑64). Gleichverteilung der UUIDv4 hilft der Dekodierung.

**Nachrichtentypen**

```
MSG_SKETCH_INIT { version, k_hint, field_bits=64, payload=sketch_bytes }
MSG_SKETCH_MORE { k_additional, payload=sketch_bytes }   # rateless Nachliefern
MSG_MISSING_REQ { ids[] }                                 # optional Ack/Nack
MSG_PAYLOAD { triage_objects[] }                          # eigentliche Daten
```

**Parameter**

* `k_hint`: erwartete maximale Differenz (Startwert), z. B. 8
* `field_bits`: 64 (passend zu 64‑Bit Hash)
* `rateless`: Empfänger fordert bei Bedarf zusätzliche Paritätsinformationen mit `MSG_SKETCH_MORE` an, bis Dekodierung gelingt.

**Ablauf**

1. **A→B:** `MSG_SKETCH_INIT(k_hint, sketch(A))`
2. **B:** versuche `Δ = reconcile(sketch(A), sketch(B))`

   * **Erfolg:** `Δ = {missing_B, missing_A}` → **B→A:** `MSG_MISSING_REQ(missing_B)`
   * **Fehlschlag:** **B→A:** `MSG_SKETCH_MORE(k_additional)` (z. B. +8), A sendet zusätzliche Parität, zurück zu Schritt 2.
3. **A→B:** `MSG_PAYLOAD(triage for missing_B)`; parallel **B→A:** `MSG_PAYLOAD(triage for missing_A)`
4. Beide Seiten aktualisieren `known_triages` und beenden die Session.

**Eigenschaften**

* Kommunikativer Overhead ~ O(|Δ|), robust bei instabilen Verbindungen (inkrementell).
* Ein Round‑Trip im Bestfall (Erfolg mit `k_hint`).
* Fallback: wenn mehrfache Nachlieferung scheitert → schicke kompaktes `ID-Set` nur der *jüngsten* N Einträge (zeitgebunden) oder fallweise Bloom‑Filter.

##### Pseudocode (Empfängerseite, minisketch)

```
def on_sketch_init(peer, sketch_bytes, k_hint):
    local = build_sketch(known_hashes(), k_hint)
    delta = try_reconcile(sketch_bytes, local)
    if delta.success:
        missing_from_peer = delta.missing_remote  # wir brauchen diese IDs
        send(peer, MSG_MISSING_REQ(missing_from_peer))
    else:
        send(peer, MSG_SKETCH_MORE(k_additional()))


def on_sketch_more(peer, sketch_bytes):
    delta = try_reconcile(accumulate(sketch_bytes), local_state.sketch)
    if delta.success:
        send(peer, MSG_MISSING_REQ(delta.missing_remote))
    else:
        send(peer, MSG_SKETCH_MORE(k_additional()))


def on_payload(peer, triage_objects):
    for t in triage_objects:
        if t.id not in known_triages:
            store(t)
            known_triages.add(t.id)
    # optional: sofort an andere aktive Peers weiterreichen (ohne Duplikate)
```

##### Pseudocode (Senderseite, minisketch)

```
def initiate_sync(peer):
    sketch = build_sketch(known_hashes(), k_hint_default)
    send(peer, MSG_SKETCH_INIT(k_hint_default, sketch))

def on_missing_req(peer, ids):
    payload = [triage_storage[i] for i in ids if i in triage_storage]
    send(peer, MSG_PAYLOAD(payload))
```

##### Sicherheits- und Robustheitsnotizen

* **Authentizität/Integrität:** signiere `MSG_PAYLOAD` (z. B. HMAC) oder verwende eine Session‑MAC.
* **Ratenbegrenzung:** pro Verbindung max. X Sketch‑Nachlieferungen, Abbruch bei Budget‑Überschreitung.
* **Priorisierung:** fordere zuerst fehlende **RED/YELLOW** IDs an; `MSG_MISSING_REQ` kann eine sortierte ID‑Liste enthalten.
* **BLE‑Praxis:** segmentiere Nachrichten < MTU; nutze Write‑Without‑Response wo möglich.

### 3.2 `RoutingUpdateReceived(from_peer, sink_id, hop_count)`

* Input: Nachricht `RU(from_peer, sink_id, h)`.
* Transition:

  * Falls `h+1 < current_hopcount(sink_id)` oder kein Eintrag existiert:

    * Setze `routing_table[sink_id][from_peer] = h+1`.
    * Aktualisiere `last_update = now()`.
  * Optional: leite `RU(sink_id, h+1)` an andere Peers in `active_connections` \ {from_peer} weiter.

### 3.3 `TriageReceived(entry, from_peer)`

* Input: `Triage(entry)`.
* Transition:

  * Falls `entry.id ∉ known_triages`:

    * Füge `entry` zu `triage_storage` hinzu und `known_triages = known_triages ∪ {entry.id}`.
    * Für jeden Peer q ∈ `active_connections` \ {from_peer}:

      * Falls q das Entry nicht kennt, sende `Triage(entry)` an q.

### 3.4 `SinkDisappeared(sink_id)`

* Input: Timeout für Senke S erreicht.
* Transition:

  * Markiere `routing_table[sink_id]` als inaktiv und starte einen Inaktivitäts‑Timer (10 Minuten).
  * Flooding wird nur erlaubt, wenn (a) mindestens eine Routing-Tabelle inaktiv ist **und** deren Timer noch läuft oder (b) keine aktive Tabelle mehr existiert.
  * Andernfalls bleibt Flooding deaktiviert.

### 3.5 `SinkReconnect(sink_id)`

* Input: eine Senke S sendet `RoutingUpdate(sink_id, hop_count=0)`.
* Transition:

  * Setze `routing_table[sink_id] = {sender:1}`.
  * Initialisiere `last_update = now()`.
  * Stoppe den Inaktivitäts‑Timer dieser Senke.
  * Leite dieses Update an alle Nachbarn weiter.

---

## 4. Verhalten beim Senden

### Sending decision (Guarded Flooding + Backup Multipath)

Beim Senden wird Flooding nur dann verwendet, wenn die Flooding‑Bedingungen erfüllt sind (siehe 3.4). Zusätzlich kann bei bekannter Route eine **limitierte, gezielte Redundanz** genutzt werden (Abschnitt 5).

```python
# Sending decision with Flooding-guard and backup paths
if peer_knows_sink and peer_has_lower_hop_count:
    send_targeted(triage, peer)

    # Optional begrenzte Redundanz, nur wenn Flooding NICHT aktiv
    if not flooding_allowed() and allow_backup(triage):
        backups = select_backup_hops(K=2, hop_leq=peer.hop_count)
        for q in backups:
            send_targeted_once(triage, q)
else:
    if flooding_allowed():
        send_flooded(triage, all_connected_peers)
    else:
        # Kein Flooding erlaubt: sende nur an Peers mit relevanter Routinginfo
        peers = [q for q in all_connected_peers if q.knows_any_sink()]
        if peers:
            send_to(peers, triage)
        else:
            buffer(triage)
```

**Implementationshinweise**

* `allow_backup(triage)`: prüft Priorität (RED/YELLOW), Budget, Einmaligkeit (`sent_backup[triage_id]==False`).
* `select_backup_hops`: wählt Peers mit gleicher/geringerer Hop-Distanz, bevorzugt andere NextHop-IDs oder disjunkte Eltern im Routing-Graph, limitiert auf `K`.

### Bei Reconnect einer Senke

* Sink sendet **RoutingUpdate mit hop_count=0**
* Tabelle wird von allen Nodes neu aufgebaut
* Alte Floods werden durch gezielte Routen ersetzt

---

## 5. Opportunistisches Routing-Backup

Selbst bei bekannter Route zur Senke kann eine Triage **redundant und gezielt** an mehrere Next-Hops gesendet werden, um Robustheit zu erhöhen. Das ist **kein Flooding** (keine Verteilung an alle), sondern **begrenzte Parallelisierung** auf wenige, gut geeignete Peers.

**Regeln**

* **Einmaligkeit pro Triage:** jede Triage darf nur **einmal** redundant versendet werden (Counter pro `triage_id`).
* **Kandidatenauswahl:** wähle bis zu `K` zusätzliche Peers (z. B. `K=1..2`) mit **niedrigerem oder gleichem Hop-Count** zur Ziel-Senke und **unabhängigen Pfaden**, soweit erkennbar.
* **Prioritätssteuerung:** aktiviere Redundanz nur für **RED/YELLOW**, optional für GREEN bei schlechter Netzlage.
* **Timer-Guard:** ignoriere Backup‑Versand, wenn `flooding_allowed()` aktiv ist (dann übernimmt die Flooding‑Policy); Backup ersetzt **nicht** die Flooding-Regel.
* **Budget-Guard:** max. `R` redundante Bytes pro Verbindung/Zeiteinheit (Energie/Throughput‑Schutz).

**Pseudocode (Zusatzzweig)**

```python
if route_to_sink_known():
    primary = best_next_hop()
    send_targeted(triage, primary)

    if not flooding_allowed() and allow_backup(triage):
        backups = select_backup_hops(K, hop_leq=primary.hop_count)
        for q in backups:
            send_targeted_once(triage, q)  # setzt sent_backup[triage_id] = True
```

**Hinweis zur Interaktion mit Flooding:**

* Läuft ein Inaktivitäts‑Timer oder existiert keine aktive Routing‑Tabelle, greift die **Flooding‑Policy** (Abschnitt 3.4/4). In diesem Fall **keine** zusätzlichen Backups – die Redundanz entsteht bereits durch Flooding.

---

##
