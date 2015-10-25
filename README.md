HATCH
=====

a programming language
----------------------

By [Sarah Gould](http://www.zenzoa.com)

Hatch is a little language that's based on closures and lazy evaluation, and transcompiles into Javascript. It's really only a toy, and half-finished at that (no lists, loops, or even non-integer numbers). Even so, I had fun making it, and I hope you have fun playing with it!

Definitions
-----------
```
<< This is a comment. >>
a : 1
a << Returns: 1 >>
```

Objects
-------
```
b : {
    x : 1
    y : 2
    z : "something unexpected"
    }
b.x << Returns: 1 >>
```

Functions
---------
```
c : { (p q)
    add( mul(p p) mul(q q) )
    }
c(4 5) << Returns: 41 >>
```

Closures
--------
```
d : {
    u : 40
    addToMe : { (v)
        add( u v )
        }
    }

d.addToMe(2) << Returns 42 >>
```

Modules
-------
```
e : {
    public : "now you see me"
    _private : "now you don't"
    getPrivate : { (password)
        if(eq(password "gingko")
            _private
            "nuh-uh-uh! you did't say the magic word")
        }
    }
e.public, << Returns: now you see me" >>
e.getPrivate("hi"), << Returns: nuh-uh-uh! you did't say the magic word" >>
e.getPrivate("gingko") << Returns: now you see don't" >>
```

A sample Hatch program
----------------------
```
newVector : {(x_prime y_prime)
    {x:x_prime y:y_prime}
    }

addVectors : {(a b)
    newVector(
        add(a.x b.x)
        add(a.y b.y))
    }

vector1 : newVector(1 1)
vector2 : newVector(1 2)

if( eq( addVectors(vector1 vector2).x
        2)
    "hi"
    "bye")
```