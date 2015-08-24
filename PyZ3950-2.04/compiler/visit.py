# Modeled on Python's Lib/compiler/visitor.py

class ASTWalk:
    def default(self, node, *args):
        for child in node.getChildNodes():
            self.dispatch(child, *args)

    def dispatch(self, node, *args):
        method = getattr(self.visitor, 'visit' + node.__class__.name, self.default)
        return method (node, *args)

    def preorder(self, tree, visitor, *args):
        self.visitor = visitor
        visitor.visit = self.dispatch
        self.dispatch(tree, *args)
