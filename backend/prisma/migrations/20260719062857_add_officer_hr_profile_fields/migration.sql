-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CASUAL', 'ZERO_HOURS');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "PayRateType" AS ENUM ('HOURLY', 'DAILY', 'SALARY');

-- AlterTable
ALTER TABLE "Officer" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "employeeNumber" TEXT,
ADD COLUMN     "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "employmentType" "EmploymentType",
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "leaveDate" TIMESTAMP(3),
ADD COLUMN     "nationalInsuranceNumber" TEXT,
ADD COLUMN     "payRate" DOUBLE PRECISION,
ADD COLUMN     "payRateType" "PayRateType",
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "rightToWorkCheckedAt" TIMESTAMP(3),
ADD COLUMN     "rightToWorkConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3);
