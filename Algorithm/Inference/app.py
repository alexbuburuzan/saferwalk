from flask import Flask, request
from handler import SaferWalkHandler
import json

GRAPH_PATH = 'graph.graphml'
DISTRIBUTION_PATH = 'distribution_k25_precalc.obj'
handler = SaferWalkHandler(GRAPH_PATH, DISTRIBUTION_PATH)

app = Flask(__name__)

@app.route("/", methods=['GET', 'POST'])
def hello_world():
    coordinates = request.get_json()
    print(coordinates)
    routes = handler.predict(coordinates['start'], coordinates['dest'])

    json_object = json.dumps(routes, indent=4)
    return json_object

app.run(host='0.0.0.0', port=5000, debug=True)