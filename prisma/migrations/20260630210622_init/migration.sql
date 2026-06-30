-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "title_ciphertext" TEXT NOT NULL,
    "body_ciphertext" TEXT,
    "tags_ciphertext" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_title_index" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "blind_index" BYTEA NOT NULL,

    CONSTRAINT "entry_title_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_tag_index" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "blind_index" BYTEA NOT NULL,

    CONSTRAINT "entry_tag_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "entries_account_id_idx" ON "entries"("account_id");

-- CreateIndex
CREATE INDEX "entry_title_index_entry_id_idx" ON "entry_title_index"("entry_id");

-- CreateIndex
CREATE INDEX "entry_title_index_blind_index_idx" ON "entry_title_index"("blind_index");

-- CreateIndex
CREATE INDEX "entry_tag_index_entry_id_idx" ON "entry_tag_index"("entry_id");

-- CreateIndex
CREATE INDEX "entry_tag_index_blind_index_idx" ON "entry_tag_index"("blind_index");

-- CreateIndex
CREATE INDEX "refresh_tokens_account_id_idx" ON "refresh_tokens"("account_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_title_index" ADD CONSTRAINT "entry_title_index_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tag_index" ADD CONSTRAINT "entry_tag_index_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
