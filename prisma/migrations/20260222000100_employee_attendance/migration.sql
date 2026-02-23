-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');

-- CreateTable
CREATE TABLE "EmployeeAttendance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAttendance_companyId_employeeId_attendanceDate_key"
ON "EmployeeAttendance"("companyId", "employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_companyId_attendanceDate_idx"
ON "EmployeeAttendance"("companyId", "attendanceDate");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_employeeId_attendanceDate_idx"
ON "EmployeeAttendance"("employeeId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "EmployeeAttendance"
ADD CONSTRAINT "EmployeeAttendance_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance"
ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
