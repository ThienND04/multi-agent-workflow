# unit: server
# loại: web-service
# nguồn lệnh: package.json (gốc, server) + server/src/config/config.js + server/nodemon.json, 2026-11-18, 1991f2a
# Đại ca duyệt: 2026-11-18 (thử kit)

# BE nằm ở server/ trong monorepo npm workspaces; lockfile ở gốc repo.
UNIT_PATH=server
UNIT_KIND=web-service
PORT_OFFSET=0
HEALTH_PATH=/api/health

# Workspaces: cài ở gốc worktree. npm ci không ghi lockfile, lệch thì báo lỗi.
stack_setup() { npm --prefix "$WT" ci; }

# Script test:cov chưa có trong server/package.json: F-001 thêm (jest --coverage).
stack_test() { npm --prefix "$UNIT_DIR" run test:cov -- --maxWorkers=2; }

# KHÔNG dùng script `dev` của dự án: nó chạy nodemon --inspect (cổng gỡ lỗi 9229 cố định), hai slot sẽ đụng nhau.
# Gọi thẳng node: PORT, MONGO_URI từ .slot.server.env thắng file .env.development vì dotenv không ghi đè biến có sẵn.
stack_serve() { exec env NODE_ENV=development node "$UNIT_DIR/src/index.js"; }

# Giá trị THỬ, không phải khoá thật. MongoDB: container ots-agent-mongo ở cổng 27018, mỗi slot một database.
stack_slot_env() {
  echo "PORT=$SLOT_PORT"
  echo "MONGO_URI=mongodb://127.0.0.1:27018/ots_$SLOT_NAME"
  echo "SECRET_KEY=agent-test-secret-not-real"
  echo "JWT_SECRET=agent-test-jwt-not-real"
}
