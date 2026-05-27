const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwNixC4i3PMydDkNXZ1AxKQ1zyNwQMAY7JNBwSrRp5tH0iZTBq4QCiE9ytxLH1slVop/exec";

let poData = [];

// Load data when page opens
async function loadPOs() {
  const response = await fetch(WEB_APP_URL);
  const result = await response.json();

  if (!result.success) {
    alert("Error loading data: " + result.error);
    return;
  }

  poData = result.data;
  renderTable(poData);
}

// Build table
function renderTable(data) {
  const tableHead = document.querySelector("#poTable thead");
  const tableBody = document.querySelector("#poTable tbody");

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = "<tr><td>No data found</td></tr>";
    return;
  }

  const headers = Object.keys(data[0]);

  const headerRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });

  const actionTh = document.createElement("th");
  actionTh.textContent = "Action";
  headerRow.appendChild(actionTh);

  tableHead.appendChild(headerRow);

  data.forEach((po, rowIndex) => {
    const tr = document.createElement("tr");

    headers.forEach(header => {
      const td = document.createElement("td");

      const input = document.createElement("input");
      input.value = po[header] ?? "";
      input.dataset.field = header;
      input.dataset.rowIndex = rowIndex;

      if (header === "PO #") {
        input.readOnly = true;
      }

      td.appendChild(input);
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");

    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.onclick = () => saveRow(rowIndex);

    actionTd.appendChild(saveButton);
    tr.appendChild(actionTd);

    tableBody.appendChild(tr);
  });
}

// Save one row
async function saveRow(rowIndex) {
  const po = poData[rowIndex];
  const poNumber = po["PO #"];

  const rowInputs = document.querySelectorAll(
    `input[data-row-index="${rowIndex}"]`
  );

  const updates = {};

  rowInputs.forEach(input => {
    const field = input.dataset.field;

    if (field !== "PO #") {
      updates[field] = input.value;
    }
  });

  console.log("Sending update:", {
    action: "update",
    poNumber: poNumber,
    updates: updates
  });

  await fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      action: "update",
      poNumber: poNumber,
      updates: updates
    })
  });

  alert("Update sent to Google Sheets");
}

  loadPOs();

