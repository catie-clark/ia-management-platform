import type { Control, ControlTestingMatrix, ControlTestingMatrixSample, User } from "@/types/audit";

export type TesterExecutionStat = {
  userId: string;
  name: string;
  role: string;
  samplesStarted: number;
  samplesCompleted: number;
  loggedMinutes: number;
  avgLoggedMinutes: number | null;
  avgCycleHours: number | null;
};

export type ControlExecutionStat = {
  controlId: string;
  referenceId: string;
  name: string;
  samples: number;
  started: number;
  completed: number;
  loggedMinutes: number;
  avgCycleHours: number | null;
};

export type ExecutionTimelinePoint = {
  date: string;
  label: string;
  completed: number;
};

export type ControlTestBudgetRow = {
  matrixId: string;
  controlId: string;
  controlReferenceId: string;
  title: string;
  budgetedHours: number | null;
  actualHours: number;
  varianceHours: number | null;
  samples: number;
  completed: number;
};

export type ControlTestBudgetSummary = {
  hasData: boolean;
  hasBudgets: boolean;
  rows: ControlTestBudgetRow[];
  totalBudgetedHours: number;
  totalActualHours: number;
  varianceHours: number;
};

export type TestExecutionAnalytics = {
  hasData: boolean;
  totalSamples: number;
  startedSamples: number;
  completedSamples: number;
  loggedMinutes: number;
  loggedHours: number;
  avgLoggedMinutes: number | null;
  avgCycleHours: number | null;
  completionRate: number;
  testers: TesterExecutionStat[];
  controls: ControlExecutionStat[];
  timeline: ExecutionTimelinePoint[];
  testBudgets: ControlTestBudgetSummary;
};

/**
 * Budget-to-actual hours for each individual control test (testing matrix).
 * Actual hours are derived from per-sample logged effort.
 */
export function getControlTestBudgets({
  controls,
  matrices,
}: {
  controls: Control[];
  matrices: ControlTestingMatrix[];
}): ControlTestBudgetSummary {
  const controlById = new Map(controls.map((control) => [control.id, control]));

  const rows: ControlTestBudgetRow[] = matrices
    .map((matrix) => {
      const control = controlById.get(matrix.controlId);
      const loggedMinutes = matrix.samples.reduce((total, sample) => total + (sample.timeSpentMinutes ?? 0), 0);
      const actualHours = loggedMinutes / 60;
      const budgetedHours = matrix.budgetedHours ?? null;

      return {
        matrixId: matrix.id,
        controlId: matrix.controlId,
        controlReferenceId: control?.referenceId ?? matrix.controlId,
        title: matrix.title,
        budgetedHours,
        actualHours,
        varianceHours: budgetedHours === null ? null : actualHours - budgetedHours,
        samples: matrix.samples.length,
        completed: matrix.samples.filter((sample) => Boolean(sample.completedAt)).length,
      };
    })
    .sort((left, right) => left.controlReferenceId.localeCompare(right.controlReferenceId) || left.title.localeCompare(right.title));

  const totalBudgetedHours = rows.reduce((total, row) => total + (row.budgetedHours ?? 0), 0);
  const totalActualHours = rows.reduce((total, row) => total + row.actualHours, 0);

  return {
    hasData: rows.length > 0,
    hasBudgets: rows.some((row) => row.budgetedHours !== null),
    rows,
    totalBudgetedHours,
    totalActualHours,
    varianceHours: totalActualHours - totalBudgetedHours,
  };
}

function cycleHours(sample: ControlTestingMatrixSample): number | null {
  if (!sample.startedAt || !sample.completedAt) {
    return null;
  }

  const diffMs = new Date(sample.completedAt).getTime() - new Date(sample.startedAt).getTime();

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }

  return diffMs / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function toDateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Aggregate per-sample execution timing across all testing matrices into
 * tester-level, control-level, and timeline analytics.
 */
export function getTestExecutionAnalytics({
  controls,
  matrices,
  users,
}: {
  controls: Control[];
  matrices: ControlTestingMatrix[];
  users: User[];
}): TestExecutionAnalytics {
  const controlById = new Map(controls.map((control) => [control.id, control]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const samples = matrices.flatMap((matrix) =>
    matrix.samples.map((sample) => ({ sample, controlId: matrix.controlId })),
  );

  const testerAccumulator = new Map<
    string,
    { started: number; completed: number; minutes: number; cycleHours: number[] }
  >();
  const controlAccumulator = new Map<
    string,
    { samples: number; started: number; completed: number; minutes: number; cycleHours: number[] }
  >();
  const timelineAccumulator = new Map<string, number>();

  let totalSamples = 0;
  let startedSamples = 0;
  let completedSamples = 0;
  let loggedMinutes = 0;
  const allCycleHours: number[] = [];
  const allLoggedMinutes: number[] = [];

  for (const { sample, controlId } of samples) {
    totalSamples += 1;

    const started = Boolean(sample.startedAt);
    const completed = Boolean(sample.completedAt);
    const minutes = sample.timeSpentMinutes ?? 0;
    const cycle = cycleHours(sample);

    if (started) {
      startedSamples += 1;
    }
    if (completed) {
      completedSamples += 1;
    }
    if (sample.timeSpentMinutes && sample.timeSpentMinutes > 0) {
      loggedMinutes += minutes;
      allLoggedMinutes.push(minutes);
    }
    if (cycle !== null) {
      allCycleHours.push(cycle);
    }

    const controlStat = controlAccumulator.get(controlId) ?? {
      samples: 0,
      started: 0,
      completed: 0,
      minutes: 0,
      cycleHours: [],
    };
    controlStat.samples += 1;
    if (started) controlStat.started += 1;
    if (completed) controlStat.completed += 1;
    controlStat.minutes += minutes;
    if (cycle !== null) controlStat.cycleHours.push(cycle);
    controlAccumulator.set(controlId, controlStat);

    if (sample.testedByUserId && started) {
      const testerStat = testerAccumulator.get(sample.testedByUserId) ?? {
        started: 0,
        completed: 0,
        minutes: 0,
        cycleHours: [],
      };
      testerStat.started += 1;
      if (completed) testerStat.completed += 1;
      testerStat.minutes += minutes;
      if (cycle !== null) testerStat.cycleHours.push(cycle);
      testerAccumulator.set(sample.testedByUserId, testerStat);
    }

    if (sample.completedAt) {
      const key = toDateKey(sample.completedAt);
      timelineAccumulator.set(key, (timelineAccumulator.get(key) ?? 0) + 1);
    }
  }

  const testers: TesterExecutionStat[] = Array.from(testerAccumulator.entries())
    .map(([userId, stat]) => {
      const user = userById.get(userId);
      return {
        userId,
        name: user?.name ?? "Recorded tester",
        role: user?.role ?? "STAFF",
        samplesStarted: stat.started,
        samplesCompleted: stat.completed,
        loggedMinutes: stat.minutes,
        avgLoggedMinutes: stat.minutes > 0 ? Math.round(stat.minutes / stat.started) : null,
        avgCycleHours: average(stat.cycleHours),
      };
    })
    .sort((left, right) => right.samplesCompleted - left.samplesCompleted || right.samplesStarted - left.samplesStarted);

  const controlStats: ControlExecutionStat[] = Array.from(controlAccumulator.entries())
    .map(([controlId, stat]) => {
      const control = controlById.get(controlId);
      return {
        controlId,
        referenceId: control?.referenceId ?? controlId,
        name: control?.name ?? "Control",
        samples: stat.samples,
        started: stat.started,
        completed: stat.completed,
        loggedMinutes: stat.minutes,
        avgCycleHours: average(stat.cycleHours),
      };
    })
    .sort((left, right) => right.completed - left.completed || left.referenceId.localeCompare(right.referenceId));

  const timeline: ExecutionTimelinePoint[] = Array.from(timelineAccumulator.entries())
    .map(([date, completed]) => ({
      date,
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date)),
      completed,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const testBudgets = getControlTestBudgets({ controls, matrices });

  return {
    hasData: startedSamples > 0 || completedSamples > 0 || loggedMinutes > 0 || testBudgets.hasBudgets,
    totalSamples,
    startedSamples,
    completedSamples,
    loggedMinutes,
    loggedHours: loggedMinutes / 60,
    avgLoggedMinutes: allLoggedMinutes.length > 0 ? Math.round(average(allLoggedMinutes) ?? 0) : null,
    avgCycleHours: average(allCycleHours),
    completionRate: totalSamples > 0 ? completedSamples / totalSamples : 0,
    testers,
    controls: controlStats,
    timeline,
    testBudgets,
  };
}
