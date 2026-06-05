-- Drop the in-house Waitlist table + enum.
-- Waitlist collection lives in Tally (form id xX9AxG embedded on the landing page).
-- Admin reads waitlist responses in Tally's UI and distributes codes manually.

-- DropTable
DROP TABLE "Waitlist";

-- DropEnum
DROP TYPE "WaitlistStatus";
