// app.js (versione aggiornata con roomName come ID e gestione host/player list)

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

    currentRoomId = roomName; // usiamo il nome come ID
    currentPlayerName = playerName;
    isHost = true;

    console.log("✅ Stanza creata:", currentRoomId, "Giocatore:", currentPlayerName);

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

    currentRoomId = roomName; // usiamo il nome come ID
    currentPlayerName = name;
    isHost = false;

    console.log("✅ Entrato nella stanza:", currentRoomId, "Giocatore:", currentPlayerName);

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

      // avatar con iniziali
      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      const initials = p.split(" ").map(w => w[0].toUpperCase()).join("").slice(0, 2);
      avatar.textContent = initials;

      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name";
      nameSpan.textContent = p;

      li.appendChild(avatar);
      li.appendChild(nameSpan);

      // se sono host → pulsante rimuovi
      if (isHost && p !== currentPlayerName) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-player";
        removeBtn.innerHTML = "🗑️";
        removeBtn.addEventListener("click", async () => {
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

    // 🔹 Controllo ruoli e host
    if (data.assignments && currentPlayerName) {
      const myRoleId = data.assignments[currentPlayerName];
      if (myRoleId) showMyRoleById(myRoleId);
    }

    if (data.host && currentPlayerName) {
      isHost = (data.host === currentPlayerName);
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
  { id: "mitomane", label: "Mitomane", description: "Il tuo ruolo è quello di indicare un giocatore a sua scelta e ne prende i poteri (il potere vale solo ad inizio partita).", img: "img/mitomane.png" },
  { id: "strega", label: "Strega", description: "Il tuo ruolo è quello di scoprire chi è il lupo e resuscitare una persona (i poteri potranno essere usati dalla seconda notte).", img: "img/strega.png" }
];

const selectedCounts = {};
ROLES.forEach(r => selectedCounts[r.id] = 0);

// --- RENDER CARD RUOLI (aggiornato per replicare design) ---
function renderRolesUI() {
  const container = document.getElementById("rolesContainer");
  if (!container) return;
  container.innerHTML = "";

  ROLES.forEach(role => {
    const card = document.createElement("div");
    card.className = `role-card role-${role.id}`;

    // immagine
    const img = document.createElement("img");
    img.src = role.img;
    img.alt = role.label;
    card.appendChild(img);

    // nome
    const name = document.createElement("span");
    name.className = "role-name";
    name.innerText = role.label.toUpperCase();
    card.appendChild(name);

    // controlli
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
    if (!currentRoomId) {
      alert("Room non impostata.");
      return;
    }

    const players = Array.from(document.querySelectorAll("#playerList li")).map(li => li.textContent);
    const playersCount = players.length;

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

    let pool = [];
    Object.keys(selectedCounts).forEach(roleId => {
      for (let i = 0; i < selectedCounts[roleId]; i++) pool.push(roleId);
    });
    pool = shuffleArray(pool);

    const assignments = {};
    for (let i = 0; i < playersCount; i++) {
      assignments[players[i]] = pool[i];
    }

    const roomRef = db.collection("rooms").doc(currentRoomId);
    await roomRef.update({ assignments });

    console.log("Assignments saved:", assignments);

    const myRoleId = assignments[currentPlayerName];
    if (myRoleId) {
      showMyRoleById(myRoleId);
    } else {
      showView(viewRoom);
    }
  } catch (err) {
    console.error("Errore assegnazione ruoli:", err);
  }
});

// --- Mostra ruolo ---
function showMyRoleById(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) {
    console.warn("Role not found:", roleId);
    showView(viewRoom);
    return;
  }
  showMyRole(role);
}

// --- MOSTRA CARTA RUOLO ---
function showMyRole(role) {
  const roleCard = document.getElementById("viewRoleCard");

  // Mitomane → solo Trasformati
  if (role.id === "mitomane") {
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
          <button id="btnTransform" class="btn primary">Trasformati</button>
        </div>
      </div>

      <div id="mitomanePopup" class="popup hidden">
        <div class="popup-content">
          <h3>Scegli il personaggio in cui trasformarti</h3>
          <div id="popupRoles"></div>
          <button id="btnClosePopup" class="btn">Chiudi</button>
        </div>
      </div>
    `;
    showView(viewRoleCard);

    const transformBtn = document.getElementById("btnTransform");
    const popup = document.getElementById("mitomanePopup");
    const popupRoles = document.getElementById("popupRoles");
    const closePopup = document.getElementById("btnClosePopup");

    if (transformBtn) {
      transformBtn.addEventListener("click", () => {
        popup.classList.remove("hidden");
        popupRoles.innerHTML = "";

        ROLES.filter(r => r.id !== "mitomane").forEach(r => {
          const btn = document.createElement("button");
          btn.className = "btn";
          btn.innerText = r.label;
          btn.addEventListener("click", () => {
            popup.classList.add("hidden");
            showMyRole(r);
          });
          popupRoles.appendChild(btn);
        });
      });
    }

    if (closePopup) {
      closePopup.addEventListener("click", () => {
        popup.classList.add("hidden");
      });
    }

    return;
  }

  // --- Ruoli normali ---
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
        <button id="btnEndGame" class="btn primary">Termina partita</button>
        <button id="btnCloseGame" class="btn">Chiudi partita</button>
      </div>
    </div>
  `;
  showView(viewRoleCard);

  const cardInner = document.getElementById("roleCardInner");
  cardInner.addEventListener("click", () => {
    cardInner.classList.toggle("role-obscured");
  });

  const endBtn = document.getElementById("btnEndGame");
  if (endBtn) {
    endBtn.addEventListener("click", async () => {
      if (!currentRoomId) return;
      try {
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
      } catch (err) {
        console.error("Errore nel terminare la partita:", err);
      }
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