// app.js (versione aggiornata con gestione host/player, fix Inizia Partita e ruolo nascosto)

let currentRoomId = null;
let currentPlayerName = null;
let isHost = false;
let roomUnsubscribe = null;

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

// helper per disiscrivere onSnapshot
function unsubscribeRoom() {
  if (typeof roomUnsubscribe === "function") {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  isHost = false;
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
    const roomRef = db.collection("rooms").doc(roomName);
    const roomDoc = await roomRef.get();

    if (roomDoc.exists) {
      alert("⚠️ Esiste già una stanza con questo nome. Scegli un altro nome.");
      return;
    }

    await roomRef.set({
      createdAt: Date.now(),
      roomName: roomName,
      players: [playerName],
      host: playerName,
      ended: false
    });

    currentRoomId = roomName;
    currentPlayerName = playerName;
    isHost = true;

    document.getElementById("roomTitle").innerText = `Stanza: ${roomName}`;
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
  const roomName = document.getElementById("inputRoomId").value.trim();

  if (!name || !roomName) {
    alert("Inserisci nome e nome della stanza!");
    return;
  }

  try {
    const roomRef = db.collection("rooms").doc(roomName);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      alert("⚠️ Stanza non trovata");
      return;
    }

    await roomRef.update({
      players: firebase.firestore.FieldValue.arrayUnion(name)
    });

    currentRoomId = roomName;
    currentPlayerName = name;
    isHost = false;

    document.getElementById("roomTitle").innerText = `Stanza: ${roomName}`;
    showView(viewRoom);

    subscribeToRoom(currentRoomId);
  } catch (err) {
    console.error("Errore ingresso stanza:", err);
    alert("Impossibile entrare nella stanza");
  }
});

// --- ASCOLTA I GIOCATORI IN STANZA ---
function subscribeToRoom(roomId) {
  unsubscribeRoom();

  roomUnsubscribe = db.collection("rooms").doc(roomId).onSnapshot(doc => {
    if (!doc.exists) {
      alert("La stanza è stata chiusa.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    const data = doc.data();
    if (!data) return;

    if (data.host && currentPlayerName) {
      isHost = (data.host === currentPlayerName);
    }

    if (data.ended) {
      alert("La partita è terminata.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    // 🔹 Rendering lista giocatori
    playerList.innerHTML = "";
    (data.players || []).forEach(p => {
      const li = document.createElement("li");
      li.dataset.name = p;

      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = p.split(" ").map(w => w[0].toUpperCase()).join("").slice(0, 2);

      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name";
      nameSpan.textContent = p;

      li.appendChild(avatar);
      li.appendChild(nameSpan);

      if (isHost && p !== currentPlayerName) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-player";
        removeBtn.type = "button";
        removeBtn.innerHTML = "🗑️";
        removeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await db.collection("rooms").doc(currentRoomId).update({
              players: firebase.firestore.FieldValue.arrayRemove(p)
            });
          } catch (err) {
            console.error("Errore nel rimuovere il giocatore:", err);
          }
        });
        li.appendChild(removeBtn);
      }

      playerList.appendChild(li);
    });

    if (data.assignments && currentPlayerName) {
      const myRoleId = data.assignments[currentPlayerName];
      if (myRoleId) showMyRoleById(myRoleId);
    }
  });
}

// --- INIZIA PARTITA ---
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
  { id: "lupo", label: "Lupo", description: "Il tuo ruolo è quello di mangiare tutti gli altri giocatori per poter vincere la partita!", img: "img/lupo.png" },
  { id: "contadino", label: "Contadino", description: "Il tuo ruolo è quello di scovare tutti i lupi all’interno del villaggio!", img: "img/contadino.png" },
  { id: "comandante", label: "Comandante", description: "Il tuo ruolo è quello di proteggere una persona a tua scelta ogni notte. Puoi salvare anche te stesso per una notte.", img: "img/comandante.png" },
  { id: "veggente", label: "Veggente", description: "Il tuo ruolo è quello di scoprire i lupi per poi aiutare il villaggio ad ucciderlo.", img: "img/veggente.png" },
  { id: "mitomane", label: "Mitomane", description: "Il tuo ruolo è quello di indicare un giocatore a sua scelta e ne prende i poteri.", img: "img/mitomane.png" },
  { id: "strega", label: "Strega", description: "Il tuo ruolo è quello di scoprire chi è il lupo e resuscitare una persona.", img: "img/strega.png" }
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
    card.className = `role-card role-${role.id}`;

    const img = document.createElement("img");
    img.src = role.img;
    img.alt = role.label;
    card.appendChild(img);

    const name = document.createElement("span");
    name.className = "role-name";
    name.innerText = role.label.toUpperCase();
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

// --- ASSEGNA RUOLI ---
document.getElementById("btnAssignRoles").addEventListener("click", async () => {
  try {
    const players = Array.from(document.querySelectorAll("#playerList li"))
      .map(li => (li.dataset.name || "").trim())
      .filter(n => n.length > 0);

    const playersCount = players.length;
    let totalSelected = Object.values(selectedCounts).reduce((a, b) => a + b, 0);

    if (playersCount === 0) {
      alert("Non ci sono giocatori in stanza.");
      return;
    }
    if (totalSelected !== playersCount) {
      alert(`Devi scegliere esattamente ${playersCount} ruoli. Hai scelto ${totalSelected}.`);
      return;
    }

    let pool = [];
    Object.keys(selectedCounts).forEach(roleId => {
      for (let i = 0; i < selectedCounts[roleId]; i++) pool.push(roleId);
    });
    pool = shuffleArray(pool);

    const assignments = {};
    for (let i = 0; i < playersCount; i++) {
      assignments[players[i]] = pool[i];
    }

    await db.collection("rooms").doc(currentRoomId).update({ assignments });

    const myRoleId = assignments[currentPlayerName];
    if (myRoleId) showMyRoleById(myRoleId);
  } catch (err) {
    console.error("Errore assegnazione ruoli:", err);
  }
});

// --- Mostra ruolo ---
function showMyRoleById(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return;
  showMyRole(role);
}

// --- MOSTRA CARTA RUOLO (con oscuramento) ---
function showMyRole(role) {
  const roleCard = document.getElementById("viewRoleCard");

  roleCard.innerHTML = `
    <div id="roleCardInner" class="role-container role-${role.id}">
      <div class="role-header">LUPUS</div>
      <div class="role-image">
        <img src="${role.img}" alt="${role.label}" />
      </div>
      <h2 class="role-title">${role.label.toUpperCase()}</h2>
      <div class="role-description">
        <p>${role.description}</p>
      </div>
      <div class="role-actions">
        <button id="btnCloseGame" class="btn">Chiudi partita</button>
      </div>
    </div>
  `;
  showView(viewRoleCard);

  // toggle oscuramento (funziona anche su mobile con click/tap)
  const cardInner = document.getElementById("roleCardInner");
  if (cardInner) {
    cardInner.addEventListener("click", () => {
      cardInner.classList.toggle("role-obscured");
    });
  }

  const closeBtn = document.getElementById("btnCloseGame");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      showView(viewHome);
    });
  }
}

// --- UTILITY: shuffle ---
function shuffleArray(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}