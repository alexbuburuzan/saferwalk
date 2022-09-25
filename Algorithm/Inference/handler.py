import pickle
import math
import numpy as np
import osmnx as ox
import networkx as nx
import multiprocessing
from typing import List, Tuple, Dict
import time

Point = Tuple[float, float]

pdf_time = 0

def dist(p1 : Point, p2 : Point) -> float:
    """Euclidian distance between p1 and p2"""
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


class MultimodalDistribution():
    def __init__(
        self,
        file_path: str
    ) -> None:

        with open(file_path, 'rb') as f:
            self.distr_list, self.norm_factor, self.x_min, self.x_scale, self.y_min, self.y_scale, self.precalc = pickle.load(f)
    
    # def pdf(self, point : Point) -> float:
    #     return sum([distr.pdf(point) for distr in self.distr_list]) / self.norm_factor

    def pdf_precalc(self, point : Point) -> float:
        return self.precalc[tuple(np.round(point / 10).astype(int))] / self.norm_factor
    
    def riemann_sum(self, point1: Point, point2: Point, segment_len : int = 20) -> float:
        # convert from long, lat to x, y
        point1 = np.array([(point1[0] - self.x_min) * self.x_scale,
                           (point1[1] - self.y_min) * self.y_scale])
        point2 = np.array([(point2[0] - self.x_min) * self.x_scale,
                           (point2[1] - self.y_min) * self.y_scale])

        num_segments = int(dist(point1, point2) // segment_len)
        if num_segments == 0:
            return 0

        delta = (point2 - point1) / num_segments
        right_point = point1 + delta
        result = 0

        for _ in range(num_segments):
            a = time.time()
            result += self.pdf_precalc(right_point) * segment_len
            global pdf_time
            pdf_time += time.time() - a
            right_point += delta

        return result


class SaferWalkHandler():
    def __init__(
        self,
        graph_file_path: str,
        distribution_path: str
    ) -> None:

        self.G = self._load_graph(graph_file_path)
        self.cpus = multiprocessing.cpu_count()
        self.distr = MultimodalDistribution(distribution_path)
        self.memo = {}
        # self.precomp_graph()

    def predict(
        self,
        start_coords: Point,
        dest_coords: Point
    ) -> Tuple[float, Dict[str, List[float]]]:
        """
        (long, lat) (x, y)
        """
        results = {}

        if start_coords[1] < dest_coords[1]:
            start_coords, dest_coords = dest_coords, start_coords

        start_node, start_distance = self._get_closest_node_id(start_coords)
        dest_node, dest_distance = self._get_closest_node_id(dest_coords)

        # compute fastest route
        distance, route = self._compute_fastest_route(start_node, dest_node)
        # distance to the closest nodes in the street network
        distance += start_distance + dest_distance
        results['fastest'] = {
            'distance': distance,
            'ETA': round(distance / 78),
            'route': route
        }

        # compute safer route
        self.h_scale = distance / 300 + 3
        print('Scale heuristic by:', self.h_scale)
        distance, route = self._compute_astar_route(start_node, dest_node)
        # distance to the closest nodes in the street network
        distance += start_distance + dest_distance
        results['safer'] = {
            'distance': distance,
            'ETA': round(distance / 78),
            'route': route
        }
        global pdf_time
        print('pdf_time', pdf_time)

        return results

    def _id2coords(self, node_id: int) -> Point:
        node = self.G.nodes[node_id]
        point = [node['x'], node['y']]
        return point

    def _load_graph(self, file_path: str):
        return ox.io.load_graphml(file_path)

    def precomp_graph(self):
        self.h_scale = 10
        for u, v, _ in self.G.edges:
            safety = self.heuristic(u, v)

            for i in range(len(self.G[u][v])):
                self.G[u][v][i]['liniar_comb_weight'] = self.G[u][v][i]['length'] + safety

    def _get_closest_node_id(self, point: Point) -> Tuple[int, float]:
        return ox.distance.nearest_nodes(self.G, *point, return_dist=True)

    def heuristic(self, point1 : int, point2 : int) -> float:
        point1 = self._id2coords(point1)
        point2 = self._id2coords(point2)
        h = self.distr.riemann_sum(point1, point2) * self.h_scale

        return h

    def _process_route(self, route):
        distance = 0

        for i in range(len(route) - 1):
            node1, node2 = route[i], route[i + 1]
            edge_data = self.G.get_edge_data(node1, node2)
            # select shortest edge between the two nodes since G is a multigraph
            length = min([edge['length'] for edge in edge_data.values()])
            distance += length

        route = list(map(self._id2coords, route))
        return distance, route

    def _compute_fastest_route(self, start_node: Point, dest_node: Point) -> Tuple[float, List[Point]]:
        route = ox.distance.shortest_path(self.G, start_node, dest_node, weight='length', cpus=self.cpus)
        distance, route = self._process_route(route)

        return distance, route

    def _compute_astar_route(self, start_node: Point, dest_node: Point) -> Tuple[float, List[Point]]:
        route = nx.astar_path(self.G, start_node, dest_node, self.heuristic, weight='length')
        distance, route = self._process_route(route)

        return distance, route

    def _compute_liniar_comb_dijkstra_route(self, start_node: Point, dest_node: Point) -> Tuple[float, List[Point]]:
        route = nx.dijkstra_path(self.G, start_node, dest_node, weight='liniar_comb_weight')
        distance, route = self._process_route(route)

        return distance, route
