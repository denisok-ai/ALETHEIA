-- Шаблон сертификата ищется по courseId при каждой выдаче (одиночной и
-- массовой), а внешний ключ индексом не покрыт — поиск был полным сканом.
CREATE INDEX "CertificateTemplate_courseId_idx" ON "CertificateTemplate"("courseId");
