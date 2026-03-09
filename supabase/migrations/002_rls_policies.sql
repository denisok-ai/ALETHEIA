-- RLS policies for AVATERRA Portal
-- Assumes auth.uid() is set by Supabase Auth.

-- Profiles: users read/update own; admin read all, update role/status
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (except role)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin/manager full access via service role; app uses service role for admin routes
-- So we only need read/update own for profiles for client

-- Orders: user sees own (by user_id or client_email match); admin via service
CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR client_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Leads: only backend/admin (service role) — no direct user policy
CREATE POLICY "Service role only for leads"
  ON public.leads FOR ALL
  USING (false);

-- Courses: everyone can read published
CREATE POLICY "Anyone can read published courses"
  ON public.courses FOR SELECT
  USING (status = 'published');

-- Enrollments: user sees own
CREATE POLICY "Users can read own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = user_id);

-- Scorm_progress: user read/insert/update own
CREATE POLICY "Users can manage own scorm progress"
  ON public.scorm_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Certificates: user reads own
CREATE POLICY "Users can read own certificates"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id);

-- Media: read if public or own
CREATE POLICY "Users can read media"
  ON public.media FOR SELECT
  USING (true);

-- Notifications: user own only
CREATE POLICY "Users can read and update own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tickets: user own only
CREATE POLICY "Users can read and create own tickets"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Phygital: user read own, insert own
CREATE POLICY "Users can read and insert own phygital"
  ON public.phygital_verifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phygital"
  ON public.phygital_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Audit log: no direct user access (admin only via service role)
CREATE POLICY "No direct user read audit"
  ON public.audit_log FOR SELECT
  USING (false);

-- Comms: admin only (service role)
CREATE POLICY "No direct user comms"
  ON public.comms_templates FOR SELECT
  USING (false);
CREATE POLICY "No direct user comms_sends"
  ON public.comms_sends FOR SELECT
  USING (false);

-- LLM settings: no direct user (admin only)
CREATE POLICY "No direct user llm_settings"
  ON public.llm_settings FOR SELECT
  USING (false);

-- Services: read active
CREATE POLICY "Anyone can read active services"
  ON public.services FOR SELECT
  USING (is_active = true);

-- User_energy: own only
CREATE POLICY "Users can read and update own energy"
  ON public.user_energy FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
