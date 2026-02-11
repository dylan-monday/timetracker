import { format, startOfWeek, addDays } from "date-fns";
import type { WeekDay, WeekLine } from "@/lib/types";

export function makeWeekDays(reference = new Date()): WeekDay[] {
  const weekStart = startOfWeek(reference, { weekStartsOn: 1 });

  return new Array(7).fill(null).map((_, index) => {
    const date = addDays(weekStart, index);
    return {
      isoDate: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE"),
      day: format(date, "d")
    };
  });
}

export const internalClientNames = [
  "Business Dev",
  "Admin",
  "Team",
  "Learning",
  "Recruiting",
  "Marketing",
  "Exercise"
];

export const demoWeekLines: WeekLine[] = [
  {
    id: "l1",
    clientName: "Nike",
    projectName: "Global Campaign Sprint",
    cells: {
      "1": 180,
      "2": 210,
      "3": 120,
      "4": 240,
      "5": 90
    }
  },
  {
    id: "l2",
    clientName: "Monday + Partners",
    projectName: "Business Dev",
    cells: {
      "1": 60,
      "2": 45,
      "3": 90,
      "4": 30,
      "5": 120
    }
  },
  {
    id: "l3",
    clientName: "Google Calendar",
    projectName: "Imported Meetings (Draft)",
    isDraft: true,
    cells: {
      "2": 60,
      "4": 45
    }
  }
];
