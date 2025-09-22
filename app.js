let currentRoomId = null;
let currentPlayerName = null;
let isHost = false;

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

// --- CREA STANZA ---
btnCreate.addEventListener("click", async () => {
  const roomName = document.getElementById("inputRoomNameCreate").value.trim();
  const playerName = document.getElementById("inputNameCreate").value.trim();

  if (!roomName || !playerName) {
    return alert("Inserisci sia il nome della stanza che il tuo nome!");
  }

  try {
    const roomRef = await db.collection("rooms").add({
      createdAt: Date.now(),
      roomName: roomName,
      players: [playerName]
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
    return alert("Inserisci nome e ID stanza!");
  }

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return alert("Stanza non trovata");
    }

    await roomRef.update({
      players: firebase.firestore.FieldValue.arrayUnion(name)
    });

    currentRoomId = roomId;
    currentPlayerName = name;

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
  db.collection("rooms").doc(roomId).onSnapshot(doc => {
    const data = doc.data();
    if (!data) return;

    playerList.innerHTML = "";
    data.players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      playerList.appendChild(li);
    });
  });
}

// --- INIZIA PARTITA (solo host) ---
btnStartGame.addEventListener("click", () => {
  if (!isHost) return alert("Solo l'host può iniziare la partita");
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
  document.getElementById(`count-${roleId}`).innerText = selectedCounts[roleId];
}

// --- ASSEGNA RUOLI AI GIOCATORI (REPLACE) ---
document.getElementById("btnAssignRoles").addEventListener("click", async () => {
  try {
    if (!currentRoomId) return alert("Room non impostata.");

    // prendi i giocatori dalla UI (lista aggiornata da subscribeToRoom)
    const players = Array.from(document.querySelectorAll("#playerList li")).map(li => li.textContent);
    const playersCount = players.length;

    // calcola totale selezionato
    let totalSelected = 0;
    Object.values(selectedCounts).forEach(v => totalSelected += v);

    if (playersCount === 0) return alert("Non ci sono giocatori in stanza.");
    if (totalSelected !== playersCount) {
      return alert(`Devi scegliere esattamente ${playersCount} ruoli. Hai scelto ${totalSelected}.`);
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

  if (allRoles.length < playerList.childNodes.length) {
    return alert("Non hai selezionato abbastanza ruoli per tutti i giocatori!");
  }

  db.collection("rooms").doc(currentRoomId).update({
    assignedRoles: shuffleArray(allRoles).slice(0, playerList.childNodes.length)
  });

  showView(viewRoleCard);
});

// --- MOSTRA CARTA RUOLO (con layout personalizzato per ogni ruolo) ---
function showMyRole(role) {
  const roleCard = document.getElementById("viewRoleCard");
  roleCard.innerHTML = `
    <div class="role-container role-${role.name.toLowerCase()}">
      <div class="role-header">LUPUS</div>
      <div class="role-image">
        <img src="./img/${role.name.toLowerCase()}.png" alt="${role.name}" />
      </div>
      <h2 class="role-title">${role.name.toUpperCase()}</h2>
      <div class="role-description">
        <p>${role.description}</p>
      </div>
      <div class="role-actions">
        <button id="btnEndGame" class="btn primary">Termina partita</button>
        <button id="btnCloseGame" class="btn">Chiudi partita</button>
      </div>
    </div>
  `;
  showView(roleCard);
}
// --- UTILITY: shuffle ---
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}