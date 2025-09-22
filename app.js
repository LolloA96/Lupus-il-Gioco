// app.js (Sostituisci tutto il file con questo contenuto)

let currentRoomId = null;
let currentPlayerName = null;
let isHost = false;
let roomUnsubscribe = null; // per tenere il riferimento alla subscription

// ELEMENTI DOM
const viewHome = document.getElementById("viewHome");
const viewRoom = document.getElementById("viewRoom");
const viewRoles = document.getElementById("viewRoles");
const viewRoleCard = document.getElementById("viewRoleCard");

const btnCreate = document.getElementById("btnCreate");
const btnJoin = document.getElementById("btnJoin");
const btnStartGame = document.getElementById("btnStartGame");
const playerList = document.getElementById("playerList");

// --- FUNZIONE: cambio schermata ---
function showView(view) {
  [viewHome, viewRoom, viewRoles, viewRoleCard].forEach(v =>
    v.classList.add("hidden")
  );
  view.classList.remove("hidden");
}

// helper per disiscrivere onSnapshot (se attiva)
function unsubscribeRoom() {
  if (typeof roomUnsubscribe === "function") {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  currentRoomId = null;
  isHost = false;
  // non azzeriamo currentPlayerName: serve se si vuole rientrare
}

// --- CREA STANZA ---
btnCreate.addEventListener("click", async () => {
  const roomName = document.getElementById("inputRoomNameCreate").value.trim();
  const playerName = document.getElementById("inputNameCreate").value.trim();

  if (!roomName || !playerName) {
    alert("Inserisci sia il nome della stanza che il tuo nome!");
    return;
  }

  try {
    const roomRef = await db.collection("rooms").add({
      createdAt: Date.now(),
      roomName: roomName,
      players: [playerName],
      host: playerName,     // <--- salviamo l'host sul documento
      ended: false
    });

    currentRoomId = roomRef.id;
    currentPlayerName = playerName;
    isHost = true;

    document.getElementById(
      "roomTitle"
    ).innerText = `Stanza: ${roomName} (ID: ${currentRoomId})`;

    showView(viewRoom);
    subscribeToRoom(currentRoomId);
  } catch (err) {
    console.error("Errore creazione stanza:", err);
    alert("Errore durante la creazione della stanza");
  }
});

// --- ENTRA IN STANZA ---
btnJoin.addEventListener("click", async () => {
  const name = document.getElementById("inputNameJoin").value.trim();
  const roomId = document.getElementById("inputRoomId").value.trim();

  if (!name || !roomId) {
    alert("Inserisci nome e ID stanza!");
    return;
  }

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      alert("Stanza non trovata");
      return;
    }

    // aggiungi il giocatore
    await roomRef.update({
      players: firebase.firestore.FieldValue.arrayUnion(name)
    });

    currentRoomId = roomId;
    currentPlayerName = name;
    isHost = false;

    document.getElementById("roomTitle").innerText = `Stanza: ${roomId}`;
    showView(viewRoom);

    subscribeToRoom(roomId);
  } catch (err) {
    console.error("Errore ingresso stanza:", err);
    alert("Impossibile entrare nella stanza");
  }
});

// --- ASCOLTA I GIOCATORI IN STANZA ---
function subscribeToRoom(roomId) {
  // prima disiscriviamo se avevamo già una subscription aperta
  unsubscribeRoom();

  roomUnsubscribe = db.collection("rooms").doc(roomId).onSnapshot(doc => {
    if (!doc.exists) {
      // stanza cancellata — torna alla home
      alert("La stanza è stata chiusa.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    const data = doc.data();
    if (!data) return;

    // Se la partita è terminata, tornare alla home per tutti
    if (data.ended) {
      // mostra messaggio e torna alla home
      alert("La partita è terminata.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    // aggiorna lista giocatori
    playerList.innerHTML = "";
    (data.players || []).forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      playerList.appendChild(li);
    });

    // se ci sono assegnazioni e il player corrente c'è, mostra il suo ruolo
    if (data.assignments && currentPlayerName) {
      const myRoleId = data.assignments[currentPlayerName];
      if (myRoleId) showMyRoleById(myRoleId);
    }

    // se il documento contiene host e corrisponde al currentPlayerName, setta isHost
    if (data.host && currentPlayerName) {
      isHost = (data.host === currentPlayerName);
    }
  });
}

// --- INIZIA PARTITA (solo host) ---
btnStartGame.addEventListener("click", () => {
  if (!isHost) {
    alert("Solo l'host può iniziare la partita");
    return;
  }
  renderRolesUI();
  showView(viewRoles);
});

// --- RUOLI DISPONIBILI ---
const ROLES = [
  { id: "lupo", label: "Lupo", description: "Il lupo elimina un giocatore a turno.", img: "img/lupo.png" },
  { id: "contadino", label: "Contadino", description: "Un semplice contadino senza poteri.", img: "img/contadino.png" },
  { id: "comandante", label: "Comandante", description: "Guida i contadini.", img: "img/comandante.png" },
  { id: "veggente", label: "Veggente", description: "Scopre il ruolo di un giocatore a notte.", img: "img/veggente.png" },
  { id: "mitomane", label: "Mitomane", description: "Si crede qualcun altro.", img: "img/mitomane.png" },
  { id: "strega", label: "Strega", description: "Può salvare o eliminare qualcuno.", img: "img/strega.png" }
];

const selectedCounts = {};
ROLES.forEach(r => selectedCounts[r.id] = 0);

// --- RENDER CARD RUOLI ---
function renderRolesUI() {
  const container = document.getElementById("rolesContainer");
  if (!container) return;
  container.innerHTML = "";

  ROLES.forEach(role => {
    const card = document.createElement("div");
    card.className = "role-card";

    const img = document.createElement("img");
    img.src = role.img;
    img.alt = role.label;
    card.appendChild(img);

    const name = document.createElement("h3");
    name.innerText = role.label;
    card.appendChild(name);

    const controls = document.createElement("div");
    controls.className = "role-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.innerText = "−";
    minus.onclick = () => {
      if (selectedCounts[role.id] > 0) {
        selectedCounts[role.id]--;
        updateCount(role.id);
      }
    };

    const count = document.createElement("span");
    count.id = `count-${role.id}`;
    count.innerText = selectedCounts[role.id];

    const plus = document.createElement("button");
    plus.type = "button";
    plus.innerText = "+";
    plus.onclick = () => {
      selectedCounts[role.id]++;
      updateCount(role.id);
    };

    controls.appendChild(minus);
    controls.appendChild(count);
    controls.appendChild(plus);

    card.appendChild(controls);
    container.appendChild(card);
  });
}

function updateCount(roleId) {
  const el = document.getElementById(`count-${roleId}`);
  if (el) el.innerText = selectedCounts[roleId];
}

// --- ASSEGNA RUOLI AI GIOCATORI (sostituito) ---
document.getElementById("btnAssignRoles").addEventListener("click", async () => {
  try {
    if (!currentRoomId) {
      alert("Room non impostata.");
      return;
    }

    // prendi i giocatori dalla UI (lista aggiornata da subscribeToRoom)
    const players = Array.from(document.querySelectorAll("#playerList li")).map(li => li.textContent);
    const playersCount = players.length;

    // calcola totale selezionato
    let totalSelected = 0;
    Object.values(selectedCounts).forEach(v => totalSelected += v);

    if (playersCount === 0) {
      alert("Non ci sono giocatori in stanza.");
      return;
    }
    if (totalSelected !== playersCount) {
      alert(`Devi scegliere esattamente ${playersCount} ruoli. Hai scelto ${totalSelected}.`);
      return;
    }

    // costruisci pool di roleId (ripeti roleId count volte)
    let pool = [];
    Object.keys(selectedCounts).forEach(roleId => {
      for (let i = 0; i < selectedCounts[roleId]; i++) pool.push(roleId);
    });

    // mescola la pool
    pool = shuffleArray(pool);

    // crea mapping player -> roleId
    const assignments = {};
    for (let i = 0; i < playersCount; i++) {
      assignments[players[i]] = pool[i];
    }

    // salva su Firestore
    const roomRef = db.collection("rooms").doc(currentRoomId);
    await roomRef.update({ assignments });

    console.log("Assignments saved:", assignments);

    // mostra subito il ruolo del giocatore corrente (se è nella stanza)
    const myRoleId = assignments[currentPlayerName];
    if (myRoleId) {
      showMyRoleById(myRoleId);
    } else {
      showView(viewRoom);
    }
  } catch (err) {
    console.error("Errore assegnazione ruoli:", err);
    alert("Errore durante l'assegnazione dei ruoli (controlla console).");
  }
});

// --- Mostra ruolo a partire da roleId (utility) ---
function showMyRoleById(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) {
    console.warn("Role not found:", roleId);
    showView(viewRoom);
    return;
  }
  showMyRole(role);
}

// --- MOSTRA CARTA RUOLO (con layout personalizzato per ogni ruolo) ---
function showMyRole(role) {
  // role: oggetto {id,label,description,img}
  const roleCard = document.getElementById("viewRoleCard");
  roleCard.innerHTML = `
    <div class="role-container role-${role.id}">
      <div class="role-header">LUPUS</div>
      <div class="role-image">
        <img src="${role.img}" alt="${role.label}" />
      </div>
      <h2 class="role-title">${role.label.toUpperCase()}</h2>
      <div class="role-description">
        <p>${role.description}</p>
      </div>
      <div class="role-actions">
        <button id="btnEndGame" class="btn primary">Termina partita</button>
        <button id="btnCloseGame" class="btn">Chiudi partita</button>
      </div>
    </div>
  `;
  showView(viewRoleCard);

  // listener: Termina partita -> imposta ended:true (solo host)
  const endBtn = document.getElementById("btnEndGame");
  if (endBtn) {
    endBtn.addEventListener("click", async () => {
      if (!currentRoomId) return;
      try {
        // Controlliamo che il currentPlayerName sia host (sicurezza lato client)
        const roomSnap = await db.collection("rooms").doc(currentRoomId).get();
        const data = roomSnap.data() || {};
        if (data.host && data.host !== currentPlayerName) {
          return alert("Solo l'host può terminare la partita per tutti.");
        }

        await db.collection("rooms").doc(currentRoomId).update({
          ended: true,
          endedAt: Date.now(),
          endedBy: currentPlayerName || null
        });
        // la subscription vedrà ended:true e tornerà alla home per tutti
      } catch (err) {
        console.error("Errore nel terminare la partita:", err);
        alert("Errore nel terminare la partita (vedi console).");
      }
    });
  }

  // listener: Chiudi partita (solo UI -> torna alla home locale)
  const closeBtn = document.getElementById("btnCloseGame");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      // Se vuoi uscire solo tu, possiamo rimuovere il tuo nome dalla stanza
      // per ora: torni solo alla home senza toccare DB
      showView(viewHome);
      // opzionale: se vuoi rimuovere il nome dalla stanza:
      // db.collection("rooms").doc(currentRoomId).update({ players: firebase.firestore.FieldValue.arrayRemove(currentPlayerName) });
    });
  }
}

// --- UTILITY: shuffle ---
function shuffleArray(array) {
  // Fisher-Yates
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}