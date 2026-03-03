import * as XLSX from "xlsx";

interface ParsedTask {
  taskCode: string;
  title: string;
  estimatedMinutes: number;
  spentMinutes: number;
}

interface ParsedGroup {
  groupName: string;
  tasks: ParsedTask[];
  totalEstimatedMinutes: number;
  totalSpentMinutes: number;
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr.trim() === "") return 0;
  const str = timeStr.trim();
  let totalMinutes = 0;

  const hoursMatch = str.match(/(\d+)h/);
  const minutesMatch = str.match(/(\d+)m/);

  if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
  if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);

  if (!hoursMatch && !minutesMatch) {
    const num = parseFloat(str);
    if (!isNaN(num)) totalMinutes = Math.round(num * 60);
  }

  return totalMinutes;
}

function extractTaskCode(text: string): string | null {
  const match = text.match(/\[?(ATT-\d+)\]?/);
  return match ? match[1] : null;
}

export function parseReportXlsx(file: ArrayBuffer): ParsedGroup[] {
  const workbook = XLSX.read(file, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: (string | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const groups: ParsedGroup[] = [];
  let currentGroup: ParsedGroup | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const col0 = String(row[0] || "").trim();
    const col1 = String(row[1] || "").trim();
    const col2 = String(row[2] || "").trim();
    const col3 = String(row[3] || "").trim();

    if (col0 === "Group/Item") continue;

    const taskCode = extractTaskCode(col0);

    if (!taskCode && col0 && !col1.startsWith("[")) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        groupName: col0,
        tasks: [],
        totalEstimatedMinutes: parseTimeToMinutes(col2),
        totalSpentMinutes: parseTimeToMinutes(col3),
      };
    } else if (taskCode && currentGroup) {
      currentGroup.tasks.push({
        taskCode,
        title: col1.replace(/^\[.*?\]\s*/, "").replace(/[\[\]]/g, ""),
        estimatedMinutes: parseTimeToMinutes(col2),
        spentMinutes: parseTimeToMinutes(col3),
      });
    }
  }

  if (currentGroup) groups.push(currentGroup);

  return groups;
}

export interface MergedTask {
  taskCode: string;
  title: string;
  category: string;
  billingStatus: string;
  squad: string;
  estimatedMinutes: number;
  spentMinutes: number;
}

const CATEGORY_NAMES = [
  "Atendimento",
  "Auxílio técnico",
  "Erro script",
  "Incidente",
  "Melhoria",
  "Tarefa",
  "Épico",
  "Planejamento",
];

const BILLING_NAMES = [
  "Faturável",
  "Não faturável",
  "Nenhum faturável",
];

function normalizeGroupName(name: string): { type: "category" | "billing"; normalized: string } | null {
  const lower = name.toLowerCase().trim();
  
  for (const cat of CATEGORY_NAMES) {
    if (lower === cat.toLowerCase()) return { type: "category", normalized: cat };
  }
  
  for (const bill of BILLING_NAMES) {
    if (lower === bill.toLowerCase()) return { type: "billing", normalized: bill };
  }

  if (lower.includes("faturável") || lower.includes("faturavel")) {
    if (lower.includes("não") || lower.includes("nao")) return { type: "billing", normalized: "Não Faturável" };
    if (lower.includes("nenhum")) return { type: "billing", normalized: "Nenhum Faturável" };
    return { type: "billing", normalized: "Faturável" };
  }

  return null;
}

export function mergeReports(
  categoryFile: ArrayBuffer,
  billingFile: ArrayBuffer,
  squadFile?: ArrayBuffer
): MergedTask[] {
  const categoryGroups = parseReportXlsx(categoryFile);
  const billingGroups = parseReportXlsx(billingFile);
  const squadGroups = squadFile ? parseReportXlsx(squadFile) : [];

  // Build task map from category file
  const taskMap = new Map<string, MergedTask>();

  for (const group of categoryGroups) {
    const info = normalizeGroupName(group.groupName);
    const categoryName = info?.type === "category" ? info.normalized : group.groupName;

    for (const task of group.tasks) {
      taskMap.set(task.taskCode, {
        taskCode: task.taskCode,
        title: task.title,
        category: categoryName,
        billingStatus: "Nenhum Faturável",
        squad: "Sem Squad",
        estimatedMinutes: task.estimatedMinutes,
        spentMinutes: task.spentMinutes,
      });
    }
  }

  // Enrich with billing data
  for (const group of billingGroups) {
    const info = normalizeGroupName(group.groupName);
    const billingName = info?.type === "billing" ? info.normalized : group.groupName;

    for (const task of group.tasks) {
      const existing = taskMap.get(task.taskCode);
      if (existing) {
        existing.billingStatus = billingName;
      } else {
        taskMap.set(task.taskCode, {
          taskCode: task.taskCode,
          title: task.title,
          category: "Tarefa",
          billingStatus: billingName,
          squad: "Sem Squad",
          estimatedMinutes: task.estimatedMinutes,
          spentMinutes: task.spentMinutes,
        });
      }
    }
  }

  // Enrich with squad data
  for (const group of squadGroups) {
    const squadName = group.groupName;

    for (const task of group.tasks) {
      const existing = taskMap.get(task.taskCode);
      if (existing) {
        existing.squad = squadName;
      } else {
        taskMap.set(task.taskCode, {
          taskCode: task.taskCode,
          title: task.title,
          category: "Tarefa",
          billingStatus: "Nenhum Faturável",
          squad: squadName,
          estimatedMinutes: task.estimatedMinutes,
          spentMinutes: task.spentMinutes,
        });
      }
    }
  }

  return Array.from(taskMap.values());
}
