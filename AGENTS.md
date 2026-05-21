<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

1.  Database Schema Requirements (Prisma):

    Update the Doctor model to include a Seniority enum: SENIOR, MID_LEVEL, JUNIOR.

    Include a targetMonthlyHours integer field on the Doctor model (Default to 240 for full-time).

    Create a Shift model containing date, shiftType, and doctorId.

    ShiftType enum: LONG_DAY (12 hrs), NIGHT (12 hrs), TWENTY_FOUR (24 hrs), OFF (0 hrs).

2.  The Shift Validation Algorithm (Sequential Rules):
    Write a TypeScript function validateShiftSequence(doctorId: string, targetDate: Date, proposedShift: ShiftType, currentMonthShifts: Shift[]) that evaluates the proposed shift against the doctor's existing schedule. It must throw an error or return a validation failure if any of the following rules are broken:

        Post-24h Rest Rule: If a doctor worked a TWENTY_FOUR shift on the previous day, they MUST be assigned OFF for the proposed date. (They must have 1 or 2 days off immediately following a 24h shift).

        Long Day to 24h Rule: If a doctor worked a LONG_DAY on the previous day, assigning a TWENTY_FOUR shift on the proposed date is ALLOWED (do not block this).

        Night to 24h Rule: If a doctor worked a NIGHT shift on the previous day, assigning a TWENTY_FOUR shift on the proposed date is STRICTLY INVALID.

        Max Long Day Rule: A doctor cannot work 3 consecutive LONG_DAY shifts. (If Day -1 and Day -2 are both LONG_DAY, the proposed shift cannot be LONG_DAY).

        Max Night Rule: A doctor cannot work 3 consecutive NIGHT shifts. (If Day -1 and Day -2 are both NIGHT, the proposed shift cannot be NIGHT).

        Max Off Days Rule: A doctor cannot take 4 consecutive OFF days. (If Day -1, Day -2, and Day -3 are all OFF, the proposed shift cannot be OFF).

3.  Manpower & Team Composition Validation:
    Write a second function validateDailyManpower(date: Date, shiftType: ShiftType, assignedDoctors: Doctor[]) that enforces the following rule:

        Senior Presence: For any given LONG_DAY or NIGHT shift, if there are doctors assigned, at least one doctor in the array MUST have the Seniority level of SENIOR. There cannot be a shift consisting entirely of JUNIOR or MID_LEVEL doctors. Return a warning/error if this is violated.

4.  Monthly Hours Tracker:
    Write a helper function calculateMonthlyHours(shifts: Shift[]): number that maps the ShiftType to hours (LONG_DAY = 12, NIGHT = 12, TWENTY_FOUR = 24, OFF = 0) and sums them up.
    Include a check to compare this against the Doctor's targetMonthlyHours (240 hours for full-time) to warn the admin if the doctor is under or over their required hours.

5.  Technical Requirements for Output:

        Use pure TypeScript functions with clear return types (e.g., { isValid: boolean, error?: string }).

        Use date manipulation libraries like date-fns or native Date objects to check consecutive days accurately (accounting for month boundaries).

        Ensure the code is heavily commented so I can adjust the constraints later if hospital management changes the rules.

    <!-- END:nextjs-agent-rules -->
