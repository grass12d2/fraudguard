// Проверка тайм-аута заголовков: соединение открывается, но запрос не завершается
// (нет пустой строки после заголовков). Сервер должен закрыть такое соединение сам.
import net from "node:net";

const [host = "localhost", port = "3000"] = process.argv.slice(2);
const socket = net.connect(Number(port), host, () => {
  socket.write("GET /api/health HTTP/1.1\r\nHost: localhost\r\n"); // заголовки не завершены
  console.time("соединение закрыто через");
});
socket.on("data", (d) => console.log("ответ сервера:", String(d).split("\r\n")[0]));
socket.on("close", () => console.timeEnd("соединение закрыто через"));
