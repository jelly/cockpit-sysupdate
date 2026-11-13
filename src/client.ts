import cockpit from "cockpit";

const SOCKET = "/run/systemd/io.systemd.SysUpdate";

export function varlinkCall(method, parameters = {}) {
  return new Promise((resolve, reject) => {
    const ch = cockpit.channel({ payload: "stream", unix: SOCKET, superuser: "require", binary: true });
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;

    ch.addEventListener("message", (_ev, data) => {
        buf += decoder.decode(data, { stream: true });
        const nul = buf.indexOf("\0");

        if (nul < 0) return;

        console.log(buf);
        const reply = JSON.parse(buf.slice(0, nul));
        done = true;
        ch.close();
        if (reply.error) {
          reject(Object.assign(new Error(reply.error), { name: reply.error, parameters: reply.parameters }));
        } else {
          resolve(reply.parameters ?? {});
        }
    });

    ch.addEventListener("close", (_ev, opts) => {
        if (!done)
            reject(new Error(opts.problem || "connection closed without reply"));
    });
    ch.send(new TextEncoder().encode(JSON.stringify({ method, parameters }) + "\0"));
  });
}
