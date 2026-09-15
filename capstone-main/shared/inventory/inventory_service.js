(() => {
  "use strict";

  const ITEMS_KEY = "dentanueva_inventory_items";
  const MOVEMENTS_KEY = "dentanueva_inventory_movements";

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function readList(storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Unable to load ${storageKey}:`, error);
      return [];
    }
  }

  function getTreatmentMaterials(procedure) {
    const materials = window.DentaNuevaTreatmentMaterials || {};

    return materials[normalizeName(procedure)] || [];
  }

  function createMovementId() {
    return `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  function getPatientName(patient) {
    const fullName = [patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .join(" ");

    return fullName || patient.name || patient.patientId || "Patient";
  }

  function getMovementDate(treatment, fallbackDate) {
    const treatmentDate = new Date(`${treatment.date}T12:00:00`);

    return Number.isNaN(treatmentDate.getTime())
      ? fallbackDate
      : treatmentDate.toISOString();
  }

  function deductForTreatment(treatment, patient) {
    const assignedMaterials = getTreatmentMaterials(treatment.procedure);

    if (!assignedMaterials.length) {
      return { success: true, movements: [] };
    }

    const movements = readList(MOVEMENTS_KEY);
    const existingMovements = movements.filter(
      (movement) =>
        movement.source === "clinical-treatment" &&
        String(movement.treatmentId) === String(treatment.id),
    );

    if (existingMovements.length) {
      return {
        success: true,
        movements: existingMovements,
        alreadyProcessed: true,
      };
    }

    const items = readList(ITEMS_KEY);
    const missingItems = [];
    const insufficientItems = [];
    const deductions = [];

    assignedMaterials.forEach((material) => {
      const item = items.find((candidate) =>
        material.names.some(
          (name) => normalizeName(candidate.name) === normalizeName(name),
        ),
      );

      if (!item) {
        missingItems.push(material.names[0]);
        return;
      }

      const stock = Number(item.stock) || 0;

      if (stock < material.quantity) {
        insufficientItems.push(
          `${item.name} (${stock} ${item.unit || "unit"} available)`,
        );
        return;
      }

      deductions.push({ item, quantity: material.quantity });
    });

    if (missingItems.length || insufficientItems.length) {
      const problems = [];

      if (missingItems.length) {
        problems.push(`not found: ${missingItems.join(", ")}`);
      }

      if (insufficientItems.length) {
        problems.push(`insufficient stock: ${insufficientItems.join(", ")}`);
      }

      return {
        success: false,
        message: `Treatment cannot be saved because assigned materials are ${problems.join("; ")}.`,
      };
    }

    const now = new Date().toISOString();
    const movementDate = getMovementDate(treatment, now);
    const patientName = getPatientName(patient);
    const createdMovements = [];

    deductions.forEach(({ item, quantity }) => {
      const previousStock = Number(item.stock) || 0;
      const newStock = previousStock - quantity;
      const movement = {
        id: createMovementId(),
        itemId: item.id,
        itemName: item.name,
        type: "stock-out",
        quantity,
        previousStock,
        newStock,
        reason: `Patient treatment: ${treatment.procedure} (${patientName})`,
        source: "clinical-treatment",
        treatmentId: treatment.id,
        patientId: treatment.patientId,
        appointmentId: treatment.appointmentId || "",
        date: movementDate,
        createdAt: now,
      };

      item.stock = newStock;
      item.updatedAt = now;
      movements.push(movement);
      createdMovements.push(movement);
    });

    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
    window.dispatchEvent(new CustomEvent("inventory:data-changed"));

    return { success: true, movements: createdMovements };
  }

  window.DentaNuevaInventoryService = Object.freeze({
    ITEMS_KEY,
    MOVEMENTS_KEY,
    getTreatmentMaterials,
    deductForTreatment,
  });
})();
